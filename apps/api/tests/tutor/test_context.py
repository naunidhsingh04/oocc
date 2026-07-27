from app.tutor.context import (
    TutorTurn,
    build_system_prompt,
    count_solution_requests,
    looks_like_solution_request,
    step_window_text,
)


def test_looks_like_solution_request_matches_common_phrasings() -> None:
    assert looks_like_solution_request("just tell me the answer")
    assert looks_like_solution_request("Can you give me the full solution?")
    assert not looks_like_solution_request("why did lo change to 4?")


def test_count_solution_requests_counts_history_plus_current_question() -> None:
    history = [
        TutorTurn(role="user", content="what does mid mean?"),
        TutorTurn(role="assistant", content="it's the midpoint index"),
        TutorTurn(role="user", content="just give me the full solution"),
    ]
    assert count_solution_requests(history=history, question="why is this a bug?") == 1
    assert count_solution_requests(history=history, question="ok just tell me the answer") == 2


def test_system_prompt_refuses_the_solution_below_two_requests() -> None:
    prompt = build_system_prompt(solution_request_count=1)
    assert "do not give the complete solution" in prompt.lower()


def test_system_prompt_permits_the_solution_at_two_requests() -> None:
    prompt = build_system_prompt(solution_request_count=2)
    assert "you may give it directly" in prompt.lower()


def test_step_window_centers_on_the_current_step_and_marks_it() -> None:
    trace = {"steps": [{"i": i, "line": i + 1, "event": "line", "changed": []} for i in range(10)]}
    text = step_window_text(trace=trace, current_step=5)
    lines = text.splitlines()
    assert len(lines) == 5  # radius 2 -> steps 3..7
    assert any(line.startswith("-> ") and "step 5" in line for line in lines)


def test_step_window_clamps_at_the_edges_of_the_trace() -> None:
    trace = {"steps": [{"i": 0, "line": 1, "event": "line", "changed": []}]}
    text = step_window_text(trace=trace, current_step=0)
    assert "step 0" in text
    assert len(text.splitlines()) == 1
