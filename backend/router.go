package main

import (
	"net/http"
	
	"github.com/vectrization/noroot/services"
	"github.com/vectrization/noroot/handlers"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

func authRouter(s *services.Services) http.Handler {
	r := chi.NewRouter();

	h := handlers.NewAuthHandler(s.Auth);

	r.Post("/register", h.Register)
	r.Post("/login", h.Login)
	r.Post("/logout", func(w http.ResponseWriter, r *http.Request) {
		
	})
	r.Get("/me", func(w http.ResponseWriter, r *http.Request) {
		
	})

	return r
}

func usersRouter() http.Handler {
	r := chi.NewRouter();
	r.Get("/{uuid}", func(w http.ResponseWriter, r *http.Request) {
		uuid := chi.URLParam(r, "uuid");
		w.Write([]byte(uuid));
	})
	return r;
}

func apiRouter_v1(s *services.Services) http.Handler {
	r := chi.NewRouter();
	r.Mount("/u/", usersRouter());
	r.Mount("/auth/", authRouter(s));
	return r;
}

func Router(s *services.Services) http.Handler {
	r := chi.NewRouter();
	r.Use(middleware.Logger);
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK);
		w.Write([]byte("OK"));
	})
	r.Mount("/api/v1", apiRouter_v1(s));
	return r;
}

