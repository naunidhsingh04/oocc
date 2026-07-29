"""The LangGraph pipeline (docs/PRD.md §4.2): digest fans out to
structure_detector, insight_scanner, complexity_analyst, and
algorithm_classifier in parallel, converging on viz_planner then narrator.
Phase 2's deterministic implementations are wired in as plain nodes —
nothing about them changes to run inside a graph; each node here is a thin
async wrapper that calls the existing function and, only when an
`llm_client` is present, hands the result to that node's own narration/
fallback module. With no provider key, every deterministic node still
produces a full result; only algorithm_classifier and narrator (both
LLM-only, no deterministic core) come back empty — see
`app/routers/runs.py`'s `capabilities` flag.
"""

from __future__ import annotations

import json
from typing import Any

from langgraph.graph import END, StateGraph

from app.agents import narrator as narrator_module
from app.agents.algorithm_classifier import classify_algorithm
from app.agents.complexity_narrator import narrate_complexity
from app.agents.digest import compute_digest
from app.agents.insight_narrator import narrate_insights
from app.agents.state import PipelineState
from app.agents.structure_llm_fallback import reclassify_low_confidence
from app.agents.viz_narrator import narrate_plan
from app.analysis.complexity_analyst import analyze_complexity
from app.analysis.heap_graph import merge_heap_across_steps
from app.analysis.insight_scanner import scan_insights
from app.analysis.structure_detector import detect_structures
from app.analysis.viz_planner import plan_viz
from app.cache import Cache, cache_key
from app.telemetry import traced_node


@traced_node("digest")
async def _digest_node(state: PipelineState) -> dict[str, Any]:
    return {"digest": compute_digest(state["trace"])}


@traced_node("structure_detector")
async def _structure_detector_node(state: PipelineState) -> dict[str, Any]:
    structures = detect_structures(state["trace"])
    structures = await reclassify_low_confidence(
        structures=structures,
        merged_heap=merge_heap_across_steps(state["trace"]),
        llm_client=state.get("llm_client"),
    )
    return {"structures": structures}


@traced_node("insight_scanner")
async def _insight_scanner_node(state: PipelineState) -> dict[str, Any]:
    insights = scan_insights(state["trace"], state["source"])
    narrations = await narrate_insights(insights=insights, llm_client=state.get("llm_client"))
    return {"insights": insights, "insight_narrations": narrations}


@traced_node("complexity_analyst")
async def _complexity_analyst_node(state: PipelineState) -> dict[str, Any]:
    complexity = await analyze_complexity(state["source"], state["executor"])
    narration = await narrate_complexity(
        complexity=complexity, source=state["source"], llm_client=state.get("llm_client")
    )
    return {"complexity": complexity, "complexity_narration": narration}


@traced_node("algorithm_classifier")
async def _algorithm_classifier_node(state: PipelineState) -> dict[str, Any]:
    algorithm = await classify_algorithm(
        digest=state["digest"],
        source=state["source"],
        trace=state["trace"],
        llm_client=state.get("llm_client"),
    )
    return {"algorithm": algorithm}


@traced_node("viz_planner")
async def _viz_planner_node(state: PipelineState) -> dict[str, Any]:
    plan = plan_viz(state["source"], state["structures"], state["trace"])
    summary = await narrate_plan(plan=plan, llm_client=state.get("llm_client"))
    return {"plan": plan, "plan_summary": summary}


@traced_node("narrator")
async def _narrator_node(state: PipelineState) -> dict[str, Any]:
    narration = await narrator_module.narrate_step_ranges(
        digest=state["digest"], llm_client=state.get("llm_client")
    )
    return {"narration": narration}


def build_pipeline_graph() -> Any:
    graph = StateGraph(PipelineState)

    graph.add_node("digest", _digest_node)
    graph.add_node("structure_detector", _structure_detector_node)
    graph.add_node("insight_scanner", _insight_scanner_node)
    graph.add_node("complexity_analyst", _complexity_analyst_node)
    graph.add_node("algorithm_classifier", _algorithm_classifier_node)
    graph.add_node("viz_planner", _viz_planner_node)
    graph.add_node("narrator", _narrator_node)

    graph.set_entry_point("digest")
    parallel_nodes = [
        "structure_detector",
        "insight_scanner",
        "complexity_analyst",
        "algorithm_classifier",
    ]
    for node in parallel_nodes:
        graph.add_edge("digest", node)
        graph.add_edge(node, "viz_planner")
    graph.add_edge("viz_planner", "narrator")
    graph.add_edge("narrator", END)

    return graph.compile()


_COMPILED_GRAPH = build_pipeline_graph()


async def run_pipeline(
    *,
    trace: dict[str, Any],
    source: str,
    executor: Any,
    llm_client: Any | None,
) -> PipelineState:
    initial_state: PipelineState = {
        "trace": trace,
        "source": source,
        "executor": executor,
        "llm_client": llm_client,
    }
    # LangGraph's compiled graph is generically typed, so `.ainvoke()`
    # returns `Any` regardless of the TypedDict passed in — an explicit
    # annotation on this assignment (not a `type: ignore`) is what
    # narrows it back to `PipelineState`. The previous `type:
    # ignore[return-value]` here targeted the wrong error code (the
    # real complaint is no-any-return) and silently suppressed nothing;
    # caught only once this module was actually checked under this
    # package's own `strict = true` config, not mypy's defaults.
    result: PipelineState = await _COMPILED_GRAPH.ainvoke(initial_state)
    return result


_DETERMINISTIC_CACHE_FIELDS = ("trace", "structures", "insights", "complexity", "plan")


async def run_pipeline_cached(
    *,
    source: str,
    stdin: str,
    executor: Any,
    llm_client: Any | None,
    cache: Cache,
) -> PipelineState:
    """docs/PRD.md §4.4: `sha256(source + stdin + language)` -> the trace
    and every deterministic output, 7-day TTL. On a hit, the executor never
    runs again and none of the four parallel deterministic analyzers do
    either — only digest (cheap, pure Python, re-derived from the cached
    trace) and the LLM-only nodes run, since those are never cached (see
    app/cache.py's docstring for why).
    """
    key = cache_key(source=source, stdin=stdin)
    cached = await cache.get(key)

    if cached is not None:
        deterministic = json.loads(cached)
        digest = compute_digest(deterministic["trace"])
        narrations = await narrate_insights(
            insights=deterministic["insights"], llm_client=llm_client
        )
        complexity_narration = await narrate_complexity(
            complexity=deterministic["complexity"], source=source, llm_client=llm_client
        )
        plan_summary = await narrate_plan(plan=deterministic["plan"], llm_client=llm_client)
        algorithm = await classify_algorithm(
            digest=digest, source=source, trace=deterministic["trace"], llm_client=llm_client
        )
        step_ranges = await narrator_module.narrate_step_ranges(
            digest=digest, llm_client=llm_client
        )
        return {
            "trace": deterministic["trace"],
            "source": source,
            "digest": digest,
            "structures": deterministic["structures"],
            "insights": deterministic["insights"],
            "insight_narrations": narrations,
            "complexity": deterministic["complexity"],
            "complexity_narration": complexity_narration,
            "algorithm": algorithm,
            "plan": deterministic["plan"],
            "plan_summary": plan_summary,
            "narration": step_ranges,
        }

    trace = await executor.execute(source, stdin=stdin)
    result = await run_pipeline(
        trace=trace, source=source, executor=executor, llm_client=llm_client
    )

    to_cache = {
        field: result[field]  # type: ignore[literal-required]
        for field in _DETERMINISTIC_CACHE_FIELDS
    }
    await cache.set(key, json.dumps(to_cache))

    return result
