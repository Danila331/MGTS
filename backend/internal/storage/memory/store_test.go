package memory

import (
	"context"
	"errors"
	"testing"

	"mgts/backend/internal/modules/core/domain"
)

func TestUpdateIsAtomicOnError(t *testing.T) {
	store := New(Seed())
	before, err := store.Snapshot(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	revision := before.Revision
	expected := errors.New("stop")
	err = store.Update(context.Background(), func(state *domain.State) error {
		state.Settings.ShowFeedbackToIntern = false
		state.Touch()
		return expected
	})
	if !errors.Is(err, expected) {
		t.Fatalf("unexpected error: %v", err)
	}
	after, err := store.Snapshot(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if after.Revision != revision || !after.Settings.ShowFeedbackToIntern {
		t.Fatal("failed update was committed")
	}
}

func TestSnapshotIsIsolated(t *testing.T) {
	store := New(Seed())
	snapshot, err := store.Snapshot(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	snapshot.Settings.ShowFeedbackToIntern = false
	fresh, err := store.Snapshot(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if !fresh.Settings.ShowFeedbackToIntern {
		t.Fatal("snapshot mutation leaked into store")
	}
}
