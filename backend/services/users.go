package services

import (
	"context"
	"errors"

	"github.com/google/uuid"
)

type User struct {
	ID           string
	Username     string
	DisplayName  string
	Email        string
	PasswordHash string
}

type UserService struct {
	DB *D1Service
}

func NewUserService(db *D1Service) *UserService {
    return &UserService{
        DB: db,
    }
}

func (u *UserService) CreateUser(
	username string,
	email string,
	passwordHash string,
) error {

	ctx := context.Background()

	existing, _ := u.GetUserByEmail(email)
	if existing != nil {
		return errors.New("email already exists")
	}

	existing, _ = u.GetUserByUsername(username)
	if existing != nil {
		return errors.New("username already exists")
	}

	id := uuid.New().String()

	err := u.DB.Exec(
		ctx,
		"INSERT INTO users (id, username, display_name, email, password_hash) VALUES (?, ?, ?, ?, ?)",
		[]any{
			id,
			username,
			username,
			email,
			passwordHash,
		},
	)

	return err
}

func mapUser(row map[string]any) *User {
	return &User{
		ID:           row["id"].(string),
		Username:     row["username"].(string),
		DisplayName:  row["display_name"].(string),
		Email:        row["email"].(string),
		PasswordHash: row["password_hash"].(string),
	}
}

func (u *UserService) GetUserByEmail(email string) (*User, error) {
	rows, err := u.DB.Query(
		context.Background(),
		"SELECT id, username, display_name, email, password_hash FROM users WHERE email = ?",
		[]any{email},
	)

	if err != nil {
		return nil, err
	}

	if len(rows) == 0 {
		return nil, nil
	}

	return mapUser(rows[0]), nil
}


func (u *UserService) GetUserByUsername(username string) (*User, error) {
	rows, err := u.DB.Query(
		context.Background(),
		"SELECT id, username, display_name, email, password_hash FROM users WHERE username = ?",
		[]any{username},
	)

	if err != nil {
		return nil, err
	}

	if len(rows) == 0 {
		return nil, nil
	}

	return mapUser(rows[0]), nil
}


func (u *UserService) GetUserByID(ID string) (*User, error) {
	rows, err := u.DB.Query(
		context.Background(),
		"SELECT id, username, display_name, email, password_hash FROM users WHERE id = ?",
		[]any{ID},
	)

	if err != nil {
		return nil, err
	}

	if len(rows) == 0 {
		return nil, nil
	}

	return mapUser(rows[0]), nil
}



