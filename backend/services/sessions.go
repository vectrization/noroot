package services

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"time"
)

type Session struct {
	ID        string
	UserID    string
	CreatedAt int64
	ExpiresAt int64
}

type SessionService struct {
	DB *D1Service
}

func NewSessionService(db *D1Service) *SessionService {
	return &SessionService{
		DB: db,
	}
}

func randomID() (string, error) {
	b := make([]byte, 32)

	_, err := rand.Read(b)
	if err != nil {
		return "", err
	}

	return hex.EncodeToString(b), nil
}

func mapSession(row map[string]any) *Session {
	return &Session{
		ID:        row["id"].(string),
		UserID:    row["user_id"].(string),
		CreatedAt: int64(row["created_at"].(float64)),
		ExpiresAt: int64(row["expires_at"].(float64)),
	}
}

func (s *SessionService) CreateSession(userID string) (*Session, error) {
	id, err := randomID()
	if err != nil {
		return nil, err
	}

	now := time.Now()
	created := now.Unix()
	expires := now.Add(30 * 24 * time.Hour).Unix()

	err = s.DB.Exec(
		context.Background(),
		"INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
		[]any{
			id,
			userID,
			created,
			expires,
		},
	)

	if err != nil {
		return nil, err
	}

	return &Session{
		ID:        id,
		UserID:    userID,
		CreatedAt: created,
		ExpiresAt: expires,
	}, nil
}

func (s *SessionService) GetSession(id string) (*Session, error) {
	rows, err := s.DB.Query(
		context.Background(),
		"SELECT id, user_id, created_at, expires_at FROM sessions WHERE id = ?",
		[]any{id},
	)

	if err != nil {
		return nil, err
	}

	if len(rows) == 0 {
		return nil, nil
	}

	return mapSession(rows[0]), nil
}

func (s *SessionService) DeleteSession(id string) error {
	return s.DB.Exec(
		context.Background(),
		"DELETE FROM sessions WHERE id = ?",
		[]any{id},
	)
}
