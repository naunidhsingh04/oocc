# AUTO-GENERATED -- do not hand-edit.
# Source: packages/contracts/trace.schema.json
# Regenerate with `pnpm gen:contracts` from the repo root.

from __future__ import annotations

from enum import StrEnum
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, RootModel


class Language(StrEnum):
    """
    Source language the trace was produced from. §3.5 requires C++ to reuse this same contract.
    """

    python = 'python'
    cpp = 'cpp'


class Status(StrEnum):
    ok = 'ok'
    runtime_error = 'runtime_error'
    timeout = 'timeout'
    step_limit = 'step_limit'
    memory_limit = 'memory_limit'
    compile_error = 'compile_error'


class Meta(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    duration_ms: Annotated[float, Field(ge=0.0)]
    step_count: Annotated[
        int,
        Field(
            description='Number of steps actually recorded in `steps` (may be less than the executed step count when truncated).',
            ge=0,
        ),
    ]
    truncated: Annotated[
        bool,
        Field(
            description='True when `steps` does not contain every executed step. §3.3: on step_limit breach, keep first 40k + last 10k.'
        ),
    ]
    stdin: str
    peak_heap_objects: Annotated[int, Field(ge=0)]


class ExecutionError(BaseModel):
    """
    Populated when status is runtime_error or compile_error.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    type: Annotated[
        str, Field(description='Exception class name, e.g. "ZeroDivisionError".')
    ]
    message: str
    line: Annotated[int | None, Field(ge=1)] = None
    step: Annotated[
        int | None,
        Field(
            description='Index into `steps` (or the pre-truncation step count) where the error occurred.',
            ge=0,
        ),
    ] = None
    traceback: list[str] | None = None


class ValueInline(BaseModel):
    """
    A primitive inlined directly in the trace, e.g. {"val": 4}.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    val: Any
    repr: Annotated[
        str | None,
        Field(description='Optional display form, e.g. "None" for a Python None val.'),
    ] = None


class HeapRef(RootModel[str]):
    model_config = ConfigDict(frozen=True)
    root: Annotated[str, Field(pattern='^o[0-9]+$')]


class FrameId(RootModel[str]):
    model_config = ConfigDict(frozen=True)
    root: Annotated[str, Field(pattern='^f[0-9]+$')]


class Identifier(RootModel[str]):
    model_config = ConfigDict(frozen=True)
    root: Annotated[str, Field(pattern='^[A-Za-z_][A-Za-z0-9_]*$')]


class ChangedPath(RootModel[str]):
    model_config = ConfigDict(frozen=True)
    root: Annotated[
        str,
        Field(
            description='The `changed` path grammar (§3.2): frame_id.local | oN[index] | oN.field | oN{key}.',
            pattern='^(f[0-9]+\\.[A-Za-z_][A-Za-z0-9_]*|o[0-9]+\\[[0-9]+\\]|o[0-9]+\\.[A-Za-z_][A-Za-z0-9_]*|o[0-9]+\\{[^{}]*\\})$',
        ),
    ]


class Op(StrEnum):
    add = 'add'
    remove = 'remove'
    replace_ = 'replace'


class JsonPatchOp(BaseModel):
    """
    One RFC 6902 operation. Phase 6's diff only ever emits add/remove/replace (never move/copy/test), so those are the only ops modeled here — a hand-written JSON Patch elsewhere in the trace is not a supported input.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    op: Op
    path: Annotated[str, Field(description='A JSON Pointer (RFC 6901).')]
    value: Any | None = None


class StepEvent(StrEnum):
    line = 'line'
    call = 'call'
    return_ = 'return'
    exception = 'exception'
    stdout = 'stdout'


class HeapStr(BaseModel):
    """
    Strings longer than 40 chars move to the heap; shorter strings stay inlined as {val: "..."}.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    type: Literal['str']
    len: Annotated[int, Field(ge=0)]
    value: str


class HeapFunction(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    type: Literal['function']
    name: str
    qualname: str | None = None


class HeapOpaque(BaseModel):
    """
    Fallback for any value the tracer can't project into a richer type.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    type: Literal['opaque']
    repr: str


class ValueRef(BaseModel):
    """
    A reference into `heap`, e.g. {"ref": "o1"}.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    ref: HeapRef


class Value(RootModel[ValueInline | ValueRef | None]):
    root: Annotated[
        ValueInline | ValueRef | None,
        Field(
            description='The {val:...}/{ref:"oN"} encoding (§3.2). Primitives inline as {val}; anything else is a heap reference. Bare JSON null is accepted as shorthand wherever a Value is expected (e.g. a None-valued object field) and is equivalent to {"val": null, "repr": "None"} — reconciles the worked TreeNode example in §3.2, where `"right": null` appears unwrapped, with the value-encoding paragraph\'s stated rule that null is {"val": null}.'
        ),
    ]


class Frame(BaseModel):
    """
    One entry in Step.stack. Index 0 of the enclosing array is the outermost frame.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    frame_id: FrameId
    func: str
    line: Annotated[int, Field(ge=1)]
    locals: Annotated[
        dict[Identifier, Value | None],
        Field(description='Local variable bindings for this frame at this step.'),
    ]
    args: Annotated[
        list[str] | None,
        Field(
            description='Parameter names in call order, present on frames pushed by a call.'
        ),
    ] = None
    call_site_line: Annotated[
        int | None,
        Field(description="Line in the caller's frame that made this call.", ge=1),
    ] = None


class HeapList(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    type: Literal['list']
    len: Annotated[int, Field(ge=0)]
    items: list[Value | None]


class HeapTuple(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    type: Literal['tuple']
    len: Annotated[int, Field(ge=0)]
    items: list[Value | None]


class Entry(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    key: Value | None
    value: Value | None


class HeapDict(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    type: Literal['dict']
    len: Annotated[int, Field(ge=0)]
    entries: Annotated[
        list[Entry],
        Field(
            description='Insertion-ordered key/value pairs. A list (not a JSON object) because Python dict keys need not be strings.'
        ),
    ]


class HeapSet(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    type: Literal['set']
    len: Annotated[int, Field(ge=0)]
    items: list[Value | None]


class HeapInstance(BaseModel):
    """
    object (with fields) / instance of a user class. `type` is the class name, e.g. "TreeNode".
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    type: str
    fields: dict[Identifier, Value | None]


class HeapObject(
    RootModel[
        HeapList
        | HeapTuple
        | HeapDict
        | HeapSet
        | HeapStr
        | HeapFunction
        | HeapOpaque
        | HeapInstance
    ]
):
    root: Annotated[
        HeapList
        | HeapTuple
        | HeapDict
        | HeapSet
        | HeapStr
        | HeapFunction
        | HeapOpaque
        | HeapInstance,
        Field(
            description='A heap-resident value. §3.2 lists list, tuple, dict, set, str (>40 chars), object/instance (fields), function, and the opaque fallback. An object/instance uses its class name as the `type` discriminator (see the worked TreeNode example in §3.2), so `type` is unconstrained beyond excluding the reserved primitive discriminators handled by the other branches.'
        ),
    ]


class Step(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    i: Annotated[int, Field(description='0-based, monotonic step index.', ge=0)]
    event: StepEvent
    line: Annotated[int, Field(description='1-based line in source.', ge=1)]
    func: Annotated[
        str, Field(description='Name of the function owning this step (top of stack).')
    ]
    depth: Annotated[int, Field(description='Call stack depth.', ge=0)]
    stack: Annotated[list[Frame], Field(min_length=1)]
    heap: Annotated[
        dict[HeapRef, HeapObject] | None,
        Field(
            description="Full snapshot of reachable non-primitives at this step, keyed by heap id. §3.4 (Phase 6): present on keyframe steps only (every 50th step by position, plus step 0). Non-keyframe steps carry `heap_patch` instead — never both, never neither. A trace produced before Phase 6's wire optimization shipped has `heap` on every step and no `heap_patch` at all, which is still a fully valid trace (every step is trivially its own keyframe); consumers must not assume every trace uses the interval scheme."
        ),
    ] = None
    heap_patch: Annotated[
        list[JsonPatchOp] | None,
        Field(
            description='§3.4 (Phase 6): an RFC 6902 JSON Patch, `add`/`remove`/`replace` only, from the previous step\'s *reconstructed* heap to this step\'s heap. Present on non-keyframe steps instead of `heap`. Paths are JSON Pointers into the heap object, e.g. "/o1/items/4/val". Reconstruct by walking back to the nearest preceding step with `heap` set and applying every intervening step\'s `heap_patch` in order — see apps/web/lib/player/getStateAt.ts, the one seam every component reads trace state through.'
        ),
    ] = None
    stdout_delta: str
    changed: Annotated[
        list[ChangedPath],
        Field(
            description='Paths mutated since the previous step. Drives every highlight animation — must be exact.'
        ),
    ]
    returned: Value | None = None
    heap_truncated: Annotated[
        bool | None,
        Field(
            description='True when this step exceeded the 5,000 heap-objects-per-step cap (§3.3) and deep-snapshotting was stopped.'
        ),
    ] = None


class Trace(BaseModel):
    """
    OOCC execution trace envelope. PRD docs/PRD.md §3.1-3.3. This file is append-only: existing fields, enum members, and $defs must not be removed or repurposed after release. Add new optional fields or new enum members only, and bump schema_version's minor component in the same PR.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    schema_version: Annotated[
        str,
        Field(
            description='Contract version, e.g. "1.0". Bump the minor component for additive changes.',
            examples=['1.0', '1.1'],
            pattern='^[0-9]+\\.[0-9]+$',
        ),
    ]
    run_id: Annotated[
        str, Field(description='Opaque run identifier.', pattern='^r_[A-Za-z0-9]+$')
    ]
    language: Annotated[
        Language,
        Field(
            description='Source language the trace was produced from. §3.5 requires C++ to reuse this same contract.'
        ),
    ]
    source_hash: Annotated[
        str,
        Field(
            description='sha256 of the exact source text that was executed. Used as the cache key (§4.4) and for wasm artifact caching (§3.5).',
            pattern='^sha256:[a-f0-9]{64}$',
        ),
    ]
    status: Status
    meta: Meta
    error: ExecutionError | None = None
    steps: Annotated[
        list[Step],
        Field(
            description='The full step-by-step trace. May be a truncated prefix/suffix per §3.3 when meta.truncated is true.'
        ),
    ]
