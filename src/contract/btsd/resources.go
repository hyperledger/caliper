package main

type Invoice struct {
	Value uint64 `json:"volume"`
}

type Sensor struct {
	ID    uint64 `json:"id"`
	Value uint64 `json:"value"`
}
