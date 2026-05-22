package progress

import "testing"

func TestDecideCompletionAwardGrantsXPForTrustedEvidence(t *testing.T) {
	t.Parallel()

	decision := DecideCompletionAward(CompletionEvidence{
		Verified:     true,
		LearnerTurns: 1,
		Feedbacks:    1,
	})

	if !decision.Awarded {
		t.Fatalf("expected award, got %+v", decision)
	}
	if decision.XP != LessonCompletionXP {
		t.Fatalf("expected %d XP, got %d", LessonCompletionXP, decision.XP)
	}
	if decision.Reason != "lesson_completed" {
		t.Fatalf("expected lesson_completed reason, got %q", decision.Reason)
	}
}

func TestDecideCompletionAwardDeniesUnverifiedEvidence(t *testing.T) {
	t.Parallel()

	decision := DecideCompletionAward(CompletionEvidence{
		LearnerTurns: 1,
		Feedbacks:    1,
	})

	assertDenied(t, decision, "completion_not_verified")
}

func TestDecideCompletionAwardDeniesInterruptedLesson(t *testing.T) {
	t.Parallel()

	decision := DecideCompletionAward(CompletionEvidence{
		Verified:     true,
		LearnerTurns: 1,
		Feedbacks:    1,
		Interrupted:  true,
	})

	assertDenied(t, decision, "lesson_interrupted")
}

func TestDecideCompletionAwardRequiresLearnerTurn(t *testing.T) {
	t.Parallel()

	decision := DecideCompletionAward(CompletionEvidence{
		Verified:  true,
		Feedbacks: 1,
	})

	assertDenied(t, decision, "missing_learner_turn")
}

func TestDecideCompletionAwardRequiresFeedback(t *testing.T) {
	t.Parallel()

	decision := DecideCompletionAward(CompletionEvidence{
		Verified:     true,
		LearnerTurns: 1,
	})

	assertDenied(t, decision, "missing_feedback")
}

func TestApplyAwardUpdatesSnapshotOncePerAttempt(t *testing.T) {
	t.Parallel()

	decision := AwardDecision{Awarded: true, XP: LessonCompletionXP, Reason: "lesson_completed"}
	snapshot := Snapshot{}

	snapshot = ApplyAward(snapshot, "attempt-1", decision)
	snapshot = ApplyAward(snapshot, "attempt-1", decision)

	if snapshot.TotalXP != LessonCompletionXP {
		t.Fatalf("expected %d XP, got %d", LessonCompletionXP, snapshot.TotalXP)
	}
	if snapshot.CompletedLessons != 1 {
		t.Fatalf("expected 1 completed lesson, got %d", snapshot.CompletedLessons)
	}
}

func TestApplyAwardIgnoresDeniedDecision(t *testing.T) {
	t.Parallel()

	snapshot := ApplyAward(Snapshot{}, "attempt-1", AwardDecision{Reason: "missing_feedback"})

	if snapshot.TotalXP != 0 {
		t.Fatalf("expected no XP, got %d", snapshot.TotalXP)
	}
	if snapshot.CompletedLessons != 0 {
		t.Fatalf("expected no completions, got %d", snapshot.CompletedLessons)
	}
}

func assertDenied(t *testing.T, decision AwardDecision, reason string) {
	t.Helper()

	if decision.Awarded {
		t.Fatalf("expected denied decision, got %+v", decision)
	}
	if decision.XP != 0 {
		t.Fatalf("expected zero XP, got %d", decision.XP)
	}
	if decision.Reason != reason {
		t.Fatalf("expected reason %q, got %q", reason, decision.Reason)
	}
}
