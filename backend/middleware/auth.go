package middleware;

import(
	"net/http"
	"context"
	"github.com/vectrization/noroot/services"
)

type AuthMiddleware struct {
	Users *services.UserService
	Sessions *services.SessionService
}

func NewAuthMiddleware(s *services.Services) *AuthMiddleware {
	return &AuthMiddleware{
		Users: s.Users,
		Sessions: s.Sessions,
	}
}

type contextKey string;
const (
	userKey contextKey = "user"
	sessionKey contextKey = "session"
)

func CurrentUser(ctx context.Context) *services.User {
    user, _ := ctx.Value(userKey).(*services.User)
    return user
}

func CurrentSession(ctx context.Context) *services.Session {
    session, _ := ctx.Value(sessionKey).(*services.Session)
    return session
}

func (m *AuthMiddleware) RequireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cookie,err := r.Cookie("session");
		if err!=nil {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		session,err := m.Sessions.GetSession(cookie.Value);
		if err!=nil{
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		user,err := m.Users.GetUserByID(session.UserID);
		if err!=nil||user==nil {
			http.Error(w, "unauthorized", http.StatusUnauthorized);
			return
		}

		ctx := context.WithValue(r.context(), userKey, user);
		ctx := context.WithValue(ctx, sessionKey, session)

		next.ServeHTTP(w, r);
	})
}
