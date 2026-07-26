# AUTO-GENERATED -- do not hand-edit.
# Source: packages/contracts/analysis.schema.json
# Regenerate with `pnpm gen:contracts` from the repo root.

from __future__ import annotations

from enum import StrEnum
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field


class StructureKind(StrEnum):
    """
    Detected data-structure shapes. A subset of the panel registry (viz-plan.schema.json PanelType) — the structures structure_detector can actually infer from heap shape and access pattern, as opposed to always-available meta-panels like call_stack or console.
    """

    array = 'array'
    array_2d = 'array_2d'
    linked_list = 'linked_list'
    binary_tree = 'binary_tree'
    graph = 'graph'
    stack = 'stack'
    queue = 'queue'
    hash_map = 'hash_map'


class DetectedStructure(BaseModel):
    """
    One structure_detector finding, e.g. {kind: "binary_tree", root_ref: "o5", confidence: 0.94} (PRD §4.3).
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    kind: StructureKind
    root_ref: Annotated[
        str,
        Field(
            description="The heap object this structure is rooted at (a tree's root node, a graph's adjacency container, a stack/queue/array's backing list, ...).",
            pattern='^o[0-9]+$',
        ),
    ]
    confidence: Annotated[float, Field(ge=0.0, le=1.0)]
    note: Annotated[
        str | None,
        Field(
            description='Optional short, factual (non-narrated) qualifier, e.g. "ambiguous with linked_list".'
        ),
    ] = None


class InsightKind(StrEnum):
    """
    The seven deterministic detectors (PRD §4.3 table).
    """

    runaway_loop = 'runaway_loop'
    off_by_one = 'off_by_one'
    mutation_during_iteration = 'mutation_during_iteration'
    accidental_quadratic = 'accidental_quadratic'
    shadowed_builtin = 'shadowed_builtin'
    dead_variable = 'dead_variable'
    redundant_recomputation = 'redundant_recomputation'


class Severity(StrEnum):
    info = 'info'
    warning = 'warning'
    error = 'error'


class Insight(BaseModel):
    """
    One insight_scanner finding. `detail` is a short factual label (a variable name, a line number) — not narration; Phase 3's narrator turns this into prose.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    kind: InsightKind
    severity: Severity
    step_refs: Annotated[
        list[int],
        Field(
            description="Real step indices this finding is evidenced by. Never empty — an insight that can't point at a step isn't a finding."
        ),
    ]
    detail: str | None = None


class CurveModel(StrEnum):
    constant = 'constant'
    log_n = 'log_n'
    n = 'n'
    n_log_n = 'n_log_n'
    n_squared = 'n_squared'
    n_cubed = 'n_cubed'
    exponential = 'exponential'


class InputShape(StrEnum):
    random = 'random'
    sorted = 'sorted'
    reverse = 'reverse'
    all_equal = 'all_equal'


class ComplexitySample(BaseModel):
    """
    One measured (n, shape) execution, counted via the executor's counters-only mode.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    n: Annotated[int, Field(ge=1)]
    shape: InputShape
    step_count: Annotated[int, Field(ge=0)]
    timed_out: Annotated[
        bool | None,
        Field(
            description='True if this sample hit the counters-only wall-clock/step cap before completing; excluded from curve fitting.'
        ),
    ] = None


class Coefficients(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    a: float
    b: float


class CurveFit(BaseModel):
    """
    One candidate model fit against every non-timed-out sample, via least squares on step_count = a * f(n) + b.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    model: CurveModel
    r_squared: float
    coefficients: Coefficients


class ComplexityReport(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    parameter: Annotated[
        str,
        Field(
            description='The size-bearing parameter name found by AST analysis, e.g. "arr".'
        ),
    ]
    samples: list[ComplexitySample]
    fits: list[CurveFit]
    best_fit: CurveModel


class Analysis(BaseModel):
    """
    Phase 2 deterministic analysis output — structure detection, insight scanning, and empirical complexity (docs/PRD.md §4.3). Every field here is produced by rule-based or measurement-based code; none of it may ever be filled in by an LLM (CLAUDE.md "Deterministic means deterministic"). Narration/explanation text is Phase 3's job and is deliberately absent from this schema. Append-only: see trace.schema.json header for the versioning policy.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    structures: list[DetectedStructure]
    insights: list[Insight]
    complexity: Annotated[
        ComplexityReport | None,
        Field(
            description="Null when the executable's primary size-bearing parameter couldn't be confidently identified (PRD §4.3 doesn't require every program to yield a curve, only that the analysis degrades gracefully)."
        ),
    ] = None
