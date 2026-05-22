package progress

const LessonCompletionXP = 50

type CompletionEvidence struct {
	Verified     bool
	LearnerTurns int
	Feedbacks    int
	Interrupted  bool
}

type AwardDecision struct {
	Awarded bool
	XP      int
	Reason  string
}

func DecideCompletionAward(evidence CompletionEvidence) AwardDecision {
	if !evidence.Verified {
		return denied("completion_not_verified")
	}
	if evidence.Interrupted {
		return denied("lesson_interrupted")
	}
	if evidence.LearnerTurns < 1 {
		return denied("missing_learner_turn")
	}
	if evidence.Feedbacks < 1 {
		return denied("missing_feedback")
	}

	return AwardDecision{
		Awarded: true,
		XP:      LessonCompletionXP,
		Reason:  "lesson_completed",
	}
}

func ApplyAward(snapshot Snapshot, attemptID string, decision AwardDecision) Snapshot {
	if !decision.Awarded || decision.XP <= 0 || attemptID == "" {
		return snapshot
	}
	if snapshot.AwardedAttempts == nil {
		snapshot.AwardedAttempts = map[string]struct{}{}
	}
	if _, exists := snapshot.AwardedAttempts[attemptID]; exists {
		return snapshot
	}

	snapshot.TotalXP += decision.XP
	snapshot.CompletedLessons++
	snapshot.AwardedAttempts[attemptID] = struct{}{}

	return snapshot
}

type Snapshot struct {
	TotalXP          int
	CompletedLessons int
	AwardedAttempts  map[string]struct{}
}

func denied(reason string) AwardDecision {
	return AwardDecision{Reason: reason}
}
