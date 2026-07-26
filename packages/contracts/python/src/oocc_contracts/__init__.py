"""Pydantic models and validators for the OOCC trace and viz-plan contracts.

docs/PRD.md §3.1-3.3 (trace) and §4.3 (viz-plan). The canonical source of
truth is packages/contracts/{trace,viz-plan}.schema.json — everything in
oocc_contracts.generated is produced from those files by `pnpm gen:contracts`
and must never be hand-edited.
"""

from oocc_contracts.generated.trace_model import (
    ChangedPath,
    ExecutionError,
    Frame,
    FrameId,
    HeapDict,
    HeapFunction,
    HeapInstance,
    HeapList,
    HeapObject,
    HeapOpaque,
    HeapRef,
    HeapSet,
    HeapStr,
    HeapTuple,
    Language,
    Meta,
    Status,
    Step,
    StepEvent,
    Trace,
    Value,
    ValueInline,
    ValueRef,
)
from oocc_contracts.generated.viz_plan_model import (
    Annotation,
    Binding,
    GenericAnnotation,
    Panel,
    PanelRole,
    PanelType,
    PointerAnnotation,
    VizPlan,
    WindowAnnotation,
)
from oocc_contracts.validators import (
    ContractValidationError,
    validate_trace,
    validate_viz_plan,
)

__all__ = [
    "Annotation",
    "Binding",
    "ChangedPath",
    "ContractValidationError",
    "ExecutionError",
    "Frame",
    "FrameId",
    "GenericAnnotation",
    "HeapDict",
    "HeapFunction",
    "HeapInstance",
    "HeapList",
    "HeapObject",
    "HeapOpaque",
    "HeapRef",
    "HeapSet",
    "HeapStr",
    "HeapTuple",
    "Language",
    "Meta",
    "Panel",
    "PanelRole",
    "PanelType",
    "PointerAnnotation",
    "Status",
    "Step",
    "StepEvent",
    "Trace",
    "Value",
    "ValueInline",
    "ValueRef",
    "VizPlan",
    "WindowAnnotation",
    "validate_trace",
    "validate_viz_plan",
]
