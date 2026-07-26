# AUTO-GENERATED -- do not hand-edit.
# Source: packages/contracts/viz-plan.schema.json
# Regenerate with `pnpm gen:contracts` from the repo root.

from __future__ import annotations

from enum import StrEnum
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, RootModel


class PanelType(StrEnum):
    """
    Panel registry v1 (§4.3).
    """

    array = 'array'
    array_2d = 'array_2d'
    linked_list = 'linked_list'
    binary_tree = 'binary_tree'
    graph = 'graph'
    stack = 'stack'
    queue = 'queue'
    hash_map = 'hash_map'
    call_stack = 'call_stack'
    recursion_tree = 'recursion_tree'
    variables = 'variables'
    heap_objects = 'heap_objects'
    console = 'console'
    timeline = 'timeline'


class PanelRole(RootModel[str]):
    model_config = ConfigDict(frozen=True)
    root: Annotated[
        str,
        Field(
            description='Placement hint within `layout`, e.g. "primary" or "secondary".',
            min_length=1,
        ),
    ]


class Binding(RootModel[str]):
    model_config = ConfigDict(frozen=True)
    root: Annotated[
        str,
        Field(
            description='What the panel is bound to: a heap ref ("o1"), a frame path ("frame.lo"), or another addressable trace location.',
            min_length=1,
        ),
    ]


class PointerAnnotation(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    kind: Literal['pointer']
    label: str
    bind: Binding


class WindowAnnotation(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    kind: Literal['window']
    from_: Annotated[Binding, Field(alias='from')]
    to: Binding


class GenericAnnotation(BaseModel):
    """
    Forward-compatible fallback for annotation kinds not yet in the registry.
    """

    model_config = ConfigDict(
        extra='allow',
    )
    kind: str
    label: str | None = None


class Annotation(RootModel[PointerAnnotation | WindowAnnotation | GenericAnnotation]):
    root: Annotated[
        PointerAnnotation | WindowAnnotation | GenericAnnotation,
        Field(
            description='A panel decoration. "pointer" and "window" are the known kinds from §4.3\'s worked example; any other kind validates structurally as {kind, label?} plus free-form fields so the registry can grow without breaking older plans.'
        ),
    ]


class Panel(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    id: Annotated[str, Field(min_length=1)]
    type: PanelType
    binding: Binding | None = None
    role: PanelRole | None = None
    annotations: list[Annotation] | None = None


class VizPlan(BaseModel):
    """
    Panel plan emitted by the viz_planner agent node (PRD docs/PRD.md §4.3). Panel `type` must be a member of the hardcoded panel registry v1; hallucinated types must be validated against this schema and dropped before rendering. Append-only: see trace.schema.json header for the versioning policy.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    layout: Annotated[
        str,
        Field(
            description='Named workspace layout, e.g. "primary+stack".', min_length=1
        ),
    ]
    panels: list[Panel]
