"""Single-image speaker association from the MAGI v2 detection weights."""

import json

from . import TaggerError


def load(directory):
    # The detector and its text-to-character head can run on their own.
    # Load only these tensors with Forge's libraries and keep OCR in Manga OCR.
    try:
        import torch
        from torch import nn
        from transformers import ConditionalDetrConfig, ConditionalDetrImageProcessor, ConditionalDetrModel
        from transformers.models.conditional_detr.modeling_conditional_detr import ConditionalDetrMLPPredictionHead
    except (ImportError, OSError) as exc:
        raise TaggerError("ocr_speaker_runtime", type(exc).__name__) from exc

    config = json.loads((directory / "config.json").read_text(encoding="utf-8"))
    detector_config = ConditionalDetrConfig.from_dict(config["detection_model_config"])
    detector_config.use_pretrained_backbone = False
    dim = detector_config.d_model
    model = nn.ModuleDict({
        "detection_transformer": ConditionalDetrModel(detector_config),
        "bbox_predictor": ConditionalDetrMLPPredictionHead(dim, dim, 4, 3),
        "class_labels_classifier": nn.Linear(dim, detector_config.num_labels),
        "text_character_matching_head": ConditionalDetrMLPPredictionHead(3 * dim, dim, 1, 3),
        "is_this_text_a_dialogue": nn.Linear(dim, 1),
    }).eval()
    weights = torch.load(directory / "pytorch_model.bin", map_location="cpu", weights_only=True, mmap=True)
    model.load_state_dict({name: value for name, value in weights.items() if name.partition(".")[0] in model})
    processor = ConditionalDetrImageProcessor.from_dict(config["detection_image_preprocessing_config"])
    return processor, model


def predict(image, processor, model, target):
    import torch
    from torchvision.ops import nms
    from transformers.image_transforms import center_to_corners_format
    from transformers.models.conditional_detr.modeling_conditional_detr import inverse_sigmoid

    # Match the training input in the author's model card. The last five queries
    # encode relationships rather than detections. Query -4 encodes text-to-character.
    inputs = processor(images=image.convert("L").convert("RGB"), return_tensors="pt").to(target)
    output = model["detection_transformer"](**inputs, return_dict=True)
    objects = output.last_hidden_state[0, :-5]
    relation = output.last_hidden_state[0, -4]
    anchors = output.reference_points.transpose(0, 1)[0, :-5]
    raw_boxes = model["bbox_predictor"](objects)
    raw_boxes[:, :2] += inverse_sigmoid(anchors)
    boxes = center_to_corners_format(raw_boxes.sigmoid()).clamp(0, 1)
    boxes *= boxes.new_tensor([image.width, image.height, image.width, image.height])
    scores, labels = model["class_labels_classifier"](objects).max(-1)
    scores = scores.sigmoid()

    def select(label, threshold):
        indices = torch.where((labels == label) & (scores > threshold))[0]
        return indices[nms(boxes[indices], scores[indices], 0.5)]

    people = select(0, 0.30)
    texts = select(1, 0.30)
    panels = select(2, 0.20)
    text_tokens = objects[texts]
    essential = (model["is_this_text_a_dialogue"](text_tokens).flatten() > 0.5).tolist()
    links = []
    if len(people) and len(texts):
        person_tokens = objects[people]
        paired = torch.cat((
            text_tokens[:, None, :].expand(-1, len(people), -1),
            person_tokens[None, :, :].expand(len(texts), -1, -1),
            relation.expand(len(texts), len(people), -1),
        ), dim=-1)
        confidence, matching = model["text_character_matching_head"](paired).squeeze(-1).sigmoid().max(dim=1)
        links = [[index, person] for index, (person, score) in enumerate(zip(matching.tolist(), confidence.tolist()))
                 if score > 0.35]
    return {"people": boxes[people].tolist(), "texts": boxes[texts].tolist(), "panels": boxes[panels].tolist(),
            "essential": essential, "links": links}
