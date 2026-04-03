from fastapi import FastAPI
import pickle
import numpy as np

app = FastAPI()

# Load your trained model
model = pickle.load(open("traffic_model.pkl", "rb"))

@app.get("/")
def home():
    return {"message": "ML Service Running 🚀"}

@app.post("/predict")
def predict(data: dict):
    try:
        # Extract inputs
        distance = data["distance"]
        traffic = data["traffic"]

        # Convert to model input format
        features = np.array([[distance, traffic]])

        # Predict
        eta = model.predict(features)[0]

        return {
            "eta": float(eta),
            "status": "success"
        }

    except Exception as e:
        return {
            "error": str(e),
            "status": "failed"
        }