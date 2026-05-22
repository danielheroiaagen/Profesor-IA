package database

import (
	"context"
	"errors"
	"testing"
)

func TestOpenRejectsMissingURL(t *testing.T) {
	t.Parallel()

	_, err := Open(context.Background(), Config{})

	if !errors.Is(err, ErrMissingURL) {
		t.Fatalf("expected ErrMissingURL, got %v", err)
	}
}

func TestCheckRequiresPinger(t *testing.T) {
	t.Parallel()

	err := Check(context.Background(), nil)

	if !errors.Is(err, ErrMissingPinger) {
		t.Fatalf("expected ErrMissingPinger, got %v", err)
	}
}

func TestCheckPingsDatabase(t *testing.T) {
	t.Parallel()

	pinger := &fakePinger{}

	if err := Check(context.Background(), pinger); err != nil {
		t.Fatalf("expected check to pass, got %v", err)
	}
	if !pinger.called {
		t.Fatal("expected pinger to be called")
	}
}

func TestCheckReturnsPingError(t *testing.T) {
	t.Parallel()

	expected := errors.New("database unavailable")
	pinger := &fakePinger{err: expected}

	err := Check(context.Background(), pinger)

	if !errors.Is(err, expected) {
		t.Fatalf("expected wrapped ping error, got %v", err)
	}
}

type fakePinger struct {
	called bool
	err    error
}

func (p *fakePinger) Ping(context.Context) error {
	p.called = true
	return p.err
}
