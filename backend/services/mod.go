package services;

type Services struct {
	D1 *D1Service
	Users *UserService
	Sessions *SessionService
	Auth *AuthService	
}

func GetServices() *Services {
	d1 := NewD1()

	users := NewUserService(d1)
	sessions := NewSessionService(d1)

	auth := NewAuthService(users, sessions)

	return &Services{
		D1: d1,
		Users: users,
		Sessions: sessions,
		Auth: auth,
	}
}
