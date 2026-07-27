package services;

import (
	"os"
	"context"
	"bytes"
	"fmt"
	"net/http"
	"encoding/json"
)

type D1Service struct {
	AccountID string
	DatabaseID string
	Token string
	HttpClient *http.Client
}

func NewD1() *D1Service {
	return &D1Service {
		AccountID: os.Getenv("CF_ACCOUNTID"),
		DatabaseID: os.Getenv("CF_DATABASEID"),
		Token: os.Getenv("CF_TOKEN"),
		HttpClient: &http.Client{},
	}
}

/* 
curl https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/d1/database/$DATABASE_ID/query \
    -H 'Content-Type: application/json' \
    -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
    -d '{
          "sql": "SELECT * FROM myTable WHERE field = ? OR field = ?;",
          "params": [
            "firstParam",
            "secondParam"
          ]
        }'
*/
type queryRequest struct {
	SQL    string `json:"sql"`
	Params []any  `json:"params"`
}

type queryResponse struct {
    Success bool              `json:"success"`
    Result  []queryResult     `json:"result"`
    Errors  []D1Error         `json:"errors"`
    Messages []D1Message      `json:"messages"`
}

type queryResult struct {
    Results []map[string]any `json:"results"`
}

type D1Error struct {
    Code int `json:"code"`
    Message string `json:"message"`
}

type D1Message struct {
    Code int `json:"code"`
    Message string `json:"message"`
}

func (d *D1Service) Query(
	ctx context.Context,
	sql string,
	params []any,
) ([]map[string]any, error) {

	payload := queryRequest{
		SQL:    sql,
		Params: params,
	}

	jsonBody, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	url := fmt.Sprintf(
		"https://api.cloudflare.com/client/v4/accounts/%s/d1/database/%s/query",
		d.AccountID,
		d.DatabaseID,
	)

	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		url,
		bytes.NewReader(jsonBody),
	)

	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+d.Token)

	resp, err := d.HttpClient.Do(req)
	if err != nil {
		return nil, err
	}

	defer resp.Body.Close()

	var data queryResponse

	err = json.NewDecoder(resp.Body).Decode(&data)
	if err != nil {
		return nil, err
	}

	if !data.Success {
	    if len(data.Errors) > 0 {
		return nil, fmt.Errorf(
		    "D1 error %d: %s",
		    data.Errors[0].Code,
		    data.Errors[0].Message,
		)
	    }

	    return nil, fmt.Errorf("D1 query failed with unknown error")
	}	

	return data.Result[0].Results, nil
}

func (d *D1Service) Exec(
	ctx context.Context,
	sql string,
	params []any,
) error {

	payload := queryRequest{
		SQL:    sql,
		Params: params,
	}

	jsonBody, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	url := fmt.Sprintf(
		"https://api.cloudflare.com/client/v4/accounts/%s/d1/database/%s/query",
		d.AccountID,
		d.DatabaseID,
	)

	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		url,
		bytes.NewReader(jsonBody),
	)

	if err != nil {
		return err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+d.Token)

	resp, err := d.HttpClient.Do(req)
	if err != nil {
		return err
	}

	defer resp.Body.Close()

	var data queryResponse

	err = json.NewDecoder(resp.Body).Decode(&data)
	if err != nil {
		return err
	}

	if !data.Success {
		return fmt.Errorf("D1 exec failed: %+v", data.Errors)
	}

	return nil
}
