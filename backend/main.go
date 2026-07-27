package main

import (
	"net/http"
	"log"
	"os"

	"github.com/vectrization/noroot/services"

	"github.com/joho/godotenv"
)

func init() {
	if godotenv.Load() != nil {
		log.Println(".env file not found.");
	}
}

func main() {
	port := os.Getenv("PORT");

	services := services.GetServices();

	r := Router(services);

	log.Println("Listening on port "+port)
	if err := http.ListenAndServe("localhost:"+port, r); err != nil {
		log.Fatal(err);
	}
}
