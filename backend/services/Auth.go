package services;

import(
	"golang.org/x/crypto/bcrypt"
	"errors"
)

type AuthService struct {
	Users *UserService
	Sessions *SessionService
}

func NewAuthService(users *UserService, sessions *SessionService) *AuthService {
	return &AuthService {
		Users: users,
		Sessions: sessions,
	}
}

func (a *AuthService) Register(
	username string,
	email string,
	password string,
) error {
	hash,err := bcrypt.GenerateFromPassword(
		[]byte(password),
		bcrypt.DefaultCost,
	)

	if err != nil {
		return err
	}
	return a.Users.CreateUser(
		username,
		email,
		string(hash),
	)
}

func (a *AuthService) Login(
	email string,
	password string,
) (*User, *Session, error) {
	user,err := a.Users.GetUserByEmail(email);
	if err != nil {
		return nil, nil, err
	}
	if user == nil {
		return nil, nil, errors.New("Invalid credentials.")
	}

	err = bcrypt.CompareHashAndPassword(
		[]byte(user.PasswordHash),
		[]byte(password),
	)
	
	if err != nil {
		return nil, nil, errors.New("Invalid credentials.")
	}

	session, err := a.Sessions.CreateSession(user.ID);
	if err != nil {
		return nil, nil, err
	}

	return user, session, nil

}

func (a *AuthService) Logout(sessionID string) error {
    return a.Sessions.DeleteSession(sessionID)
}
