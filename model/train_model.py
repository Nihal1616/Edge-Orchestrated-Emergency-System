"""
ML Traffic Prediction Model Trainer

This script:
1. Generates synthetic traffic data based on realistic patterns
2. Trains a RandomForest model to predict ETA
3. Saves the trained model for inference
"""

import numpy as np
import pandas as pd
import pickle
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_squared_error, r2_score, mean_absolute_error
import warnings
warnings.filterwarnings('ignore')

print("=" * 60)
print("🚑 TRAFFIC PREDICTION ML MODEL TRAINER")
print("=" * 60)

# ============================================================================
# STEP 1: GENERATE REALISTIC TRAFFIC DATA
# ============================================================================
print("\n[STEP 1] Generating synthetic traffic data...")
print("-" * 60)

np.random.seed(42)

# Generate 5000 training samples
n_samples = 5000

# Features that affect ETA:
# 1. Distance (1-20 km)
distance = np.random.uniform(1, 20, n_samples)

# 2. Traffic level (1-5, where 5 is heavy traffic)
traffic_level = np.random.randint(1, 6, n_samples)

# 3. Distance to hospital (2-15 km)
distance_to_hospital = np.random.uniform(2, 15, n_samples)

# 4. Hour of day (0-23) - affects traffic patterns
hour = np.random.randint(0, 24, n_samples)

# 5. Day of week (0-6, Monday=0)
day_of_week = np.random.randint(0, 7, n_samples)

# 6. Road type (1=highway, 2=main road, 3=secondary, 4=local)
road_type = np.random.randint(1, 5, n_samples)

# ============================================================================
# STEP 2: CALCULATE TARGET VARIABLE (ETA IN MINUTES)
# ============================================================================
print("[STEP 2] Computing realistic ETA with traffic patterns...")

# Base speed calculations
base_speed = 40  # km/h in urban area

# Traffic multiplier (affects speed)
traffic_multiplier = 1.0 + (traffic_level - 1) * 0.3  # 1.0 to 2.2

# Time of day multiplier (rush hours have more traffic)
hour_multiplier = np.array([
    1.5 if (7 <= h < 9 or 17 <= h < 19) else  # Rush hours: 7-9 AM, 5-7 PM
    0.5 if (23 <= h or h < 6) else  # Night: 11 PM - 6 AM
    1.0  # Normal hours
    for h in hour
])

# Road type multiplier (highways faster than local roads)
road_multiplier = np.array([
    0.8 if r == 1 else  # Highway: 20% faster
    1.0 if r == 2 else  # Main road: normal
    1.2 if r == 3 else  # Secondary: 20% slower
    1.4  # Local: 40% slower
    for r in road_type
])

# Calculate effective speed
effective_speed = base_speed / (traffic_multiplier * hour_multiplier * road_multiplier)

# Calculate ETA for ambulance to reach patient
ambulance_eta = (distance / effective_speed) * 60

# Add random noise (±2 minutes variation due to unpredictable factors)
ambulance_eta += np.random.normal(0, 2, n_samples)

# Calculate hospital delivery time
hospital_eta = (distance_to_hospital / 30) * 60  # Slower in hospital areas

# Total ETA (ambulance + hospital time)
y = ambulance_eta + hospital_eta

# Add some noise for realism
y += np.random.normal(0, 3, n_samples)

# Ensure realistic ETA (5-120 minutes)
y = np.clip(y, 5, 120)

# ============================================================================
# STEP 3: CREATE DATAFRAME AND EXPLORE DATA
# ============================================================================
print("[STEP 3] Creating and exploring dataset...")

# Combine features into dataframe
X = np.column_stack([
    distance,
    traffic_level,
    distance_to_hospital,
    hour / 24.0,  # Normalize
    day_of_week / 7.0,  # Normalize
    road_type / 4.0  # Normalize
])

feature_names = [
    "distance",
    "traffic_level",
    "distance_to_hospital",
    "hour_normalized",
    "day_of_week_normalized",
    "road_type_normalized"
]

df = pd.DataFrame(X, columns=feature_names)
df['eta_minutes'] = y

print(f"\n📊 DATASET STATISTICS:")
print(f"   • Total samples: {len(df)}")
print(f"   • Features: {len(feature_names)}")
print(f"   • ETA range: {y.min():.1f} - {y.max():.1f} minutes")
print(f"   • Average ETA: {y.mean():.1f} minutes")
print(f"\n{df.describe().round(2)}")

# ============================================================================
# STEP 4: SPLIT DATA INTO TRAIN/TEST SETS
# ============================================================================
print("\n[STEP 4] Splitting data (80% train, 20% test)...")

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

print(f"   • Training samples: {len(X_train)}")
print(f"   • Testing samples: {len(X_test)}")

# ============================================================================
# STEP 5: SCALE FEATURES
# ============================================================================
print("[STEP 5] Normalizing feature scales...")

scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)
X_test_scaled = scaler.transform(X_test)

# ============================================================================
# STEP 6: TRAIN MULTIPLE MODELS AND COMPARE
# ============================================================================
print("\n[STEP 6] Training ML models...")

models = {}

# 1. Random Forest
print("   • Training RandomForest...")
rf_model = RandomForestRegressor(
    n_estimators=100,
    max_depth=15,
    min_samples_split=5,
    random_state=42,
    n_jobs=-1
)
rf_model.fit(X_train_scaled, y_train)
models['RandomForest'] = rf_model

# 2. Gradient Boosting
print("   • Training GradientBoosting...")
gb_model = GradientBoostingRegressor(
    n_estimators=100,
    learning_rate=0.1,
    max_depth=5,
    random_state=42
)
gb_model.fit(X_train_scaled, y_train)
models['GradientBoosting'] = gb_model

# ============================================================================
# STEP 7: EVALUATE MODELS
# ============================================================================
print("\n[STEP 7] Model Evaluation:")
print("-" * 60)

best_model = None
best_score = float('-inf')

for model_name, model in models.items():
    # Predictions
    y_pred = model.predict(X_test_scaled)
    
    # Metrics
    mse = mean_squared_error(y_test, y_pred)
    rmse = np.sqrt(mse)
    mae = mean_absolute_error(y_test, y_pred)
    r2 = r2_score(y_test, y_pred)
    
    print(f"\n📈 {model_name}:")
    print(f"   • Mean Absolute Error (MAE): {mae:.2f} minutes")
    print(f"   • Root Mean Squared Error (RMSE): {rmse:.2f} minutes")
    print(f"   • R² Score: {r2:.4f}")
    
    if r2 > best_score:
        best_score = r2
        best_model = model
        best_model_name = model_name

# ============================================================================
# STEP 8: FEATURE IMPORTANCE ANALYSIS
# ============================================================================
print(f"\n[STEP 8] Feature Importance ({best_model_name}):")
print("-" * 60)

feature_importance = best_model.feature_importances_
feature_importance_df = pd.DataFrame({
    'feature': feature_names,
    'importance': feature_importance
}).sort_values('importance', ascending=False)

for idx, row in feature_importance_df.iterrows():
    importance_percent = row['importance'] * 100
    bar = "█" * int(importance_percent / 5)
    print(f"   • {row['feature']:<25} {bar:<20} {importance_percent:.1f}%")

# ============================================================================
# STEP 9: SAVE MODEL AND SCALER
# ============================================================================
print(f"\n[STEP 9] Serializing {best_model_name} model...")

# Save model
with open('traffic_model.pkl', 'wb') as f:
    pickle.dump(best_model, f)
print(f"   ✓ Model saved: traffic_model.pkl")

# Save scaler
with open('scaler.pkl', 'wb') as f:
    pickle.dump(scaler, f)
print(f"   ✓ Scaler saved: scaler.pkl")

# Save metadata
metadata = {
    'model_type': best_model_name,
    'features': feature_names,
    'r2_score': best_score,
    'mae': mae,
    'rmse': rmse,
    'training_samples': len(X_train),
    'date_trained': pd.Timestamp.now().isoformat()
}

with open('model_metadata.pkl', 'wb') as f:
    pickle.dump(metadata, f)
print(f"   ✓ Metadata saved: model_metadata.pkl")

# ============================================================================
# STEP 10: TEST WITH SAMPLE PREDICTIONS
# ============================================================================
print("\n[STEP 10] Sample Predictions:")
print("-" * 60)

# Test predictions
sample_indices = np.random.choice(len(X_test_scaled), 5, replace=False)

for i, idx in enumerate(sample_indices, 1):
    sample_features = X_test_scaled[idx].reshape(1, -1)
    prediction = best_model.predict(sample_features)[0]
    actual = y_test[idx]
    error = abs(prediction - actual)
    
    print(f"\n   Sample {i}:")
    print(f"   • Predicted ETA: {prediction:.1f} minutes")
    print(f"   • Actual ETA: {actual:.1f} minutes")
    print(f"   • Error: {error:.1f} minutes ({(error/actual)*100:.1f}%)")

# ============================================================================
# FINAL SUMMARY
# ============================================================================
print("\n" + "=" * 60)
print("✅ MODEL TRAINING COMPLETE!")
print("=" * 60)
print(f"\n🎯 Best Model: {best_model_name}")
print(f"   • R² Score: {best_score:.4f}")
print(f"   • Average Error: {mae:.2f} minutes")
print(f"   • Status: Ready for deployment")
print("\n💡 Next: Run 'python app.py' or 'uvicorn app:app --reload'")
print("=" * 60 + "\n")
