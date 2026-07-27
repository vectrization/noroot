package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/vectrization/noroot/services"
)

type AuthHandler struct {
	Auth *services.AuthService
}

func NewAuthHandler(auth *services.AuthService) *AuthHandler {
	return &AuthHandler{
		Auth: auth,
	}
}

type registerRequest struct {
	Username string `json:"username"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	var body registerRequest

	err := json.NewDecoder(r.Body).Decode(&body)
	if err != nil {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}

	err = h.Auth.Register(
		body.Username,
		body.Email,
		body.Password,
	)

	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{
		"message": "account created",
	})
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var body loginRequest

	err := json.NewDecoder(r.Body).Decode(&body)
	if err != nil {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}

	user, session, err := h.Auth.Login(
		body.Email,
		body.Password,
	)

	if err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "session",
		Value:    session.ID,
		Path:     "/",
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteLaxMode,
		Expires:  time.Unix(session.ExpiresAt, 0),
	})

	json.NewEncoder(w).Encode(map[string]any{
		"user": user,
	})
}
