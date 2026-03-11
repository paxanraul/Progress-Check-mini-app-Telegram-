users = [
    {"exercise": "bench", "weight": 100},
    {"exercise": "squat", "weight": 120},
    {"exercise": "bench", "weight": 105}
]

max_weight = 0
for user in users:
    if user["exercise"] == "bench":
        if user["weight"] > max_weight:
            max_weight = user["weight"]
print(max_weight)