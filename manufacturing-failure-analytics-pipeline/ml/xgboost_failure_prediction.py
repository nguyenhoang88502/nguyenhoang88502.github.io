"""
CO4031 BTL - Step 03: XGBoost Failure Prediction Model
Input : cleaned CSV from preprocessing step
Output: trained model, evaluation metrics, SHAP plots
"""

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import (classification_report, confusion_matrix,
                             roc_auc_score, roc_curve,
                             precision_recall_curve, ConfusionMatrixDisplay)
from imblearn.over_sampling import SMOTE
import xgboost as xgb
import shap
import pickle
import os
import warnings
warnings.filterwarnings('ignore')

# ============================================================
# CONFIGURATION
# ============================================================
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CLEANED_PATH = os.path.join(BASE_DIR, "data", "cleaned", "machine_data_cleaned.csv")
MODEL_OUTPUT = os.path.join(BASE_DIR, "ml", "xgboost_model.pkl")
SCALER_OUTPUT = os.path.join(BASE_DIR, "ml", "scaler.pkl")
PLOT_DIR = os.path.join(BASE_DIR, "ml", "plots")
os.makedirs(PLOT_DIR, exist_ok=True)

RANDOM_SEED = 42
np.random.seed(RANDOM_SEED)

# ============================================================
# STEP 1: Load Data
# ============================================================
print("=" * 60)
print(" STEP 1: Load Preprocessed Data")
print("=" * 60)

df = pd.read_csv(CLEANED_PATH)
print(f" Loaded: {df.shape}")

FEATURE_COLS = [
    'air_temp_k',
    'process_temp_k',
    'rotational_speed_rpm',
    'torque_nm',
    'tool_wear_min',
    'Temp_Differential_C',
    'Power_W',
    'Type_Encoded'
]
TARGET_COL = 'machine_failure'

# Handle column name variations (case-insensitive fallback)
for col in ['Temp_Differential_C', 'Power_W', 'Type_Encoded']:
    if col not in df.columns:
        lower = col.lower()
        if lower in df.columns:
            df[col] = df[lower]

X = df[FEATURE_COLS].copy()
y = df[TARGET_COL].copy()

print(f"\nClass distribution:")
print(y.value_counts())
print(f" Failure rate: {y.mean() * 100:.2f}%")

# ============================================================
# STEP 2: Handle Class Imbalance with SMOTE
# ============================================================
print("\n" + "=" * 60)
print(" STEP 2: Handle Class Imbalance (SMOTE)")
print("=" * 60)

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=RANDOM_SEED, stratify=y
)

print(f" Training set: {X_train.shape[0]} samples")
print(f"  - No Failure: {(y_train == 0).sum()}")
print(f"  - Failure   : {(y_train == 1).sum()}")
print(f" Test set: {X_test.shape[0]} samples")

smote = SMOTE(random_state=RANDOM_SEED, k_neighbors=5)
X_train_sm, y_train_sm = smote.fit_resample(X_train, y_train)

print(f"\nAfter SMOTE oversampling:")
print(f"  - No Failure: {(y_train_sm == 0).sum()}")
print(f"  - Failure   : {(y_train_sm == 1).sum()}")
print(" (now balanced!)")

# ============================================================
# STEP 3: Feature Scaling (StandardScaler)
# ============================================================
print("\n" + "=" * 60)
print(" STEP 3: Feature Scaling")
print("=" * 60)

scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train_sm)
X_test_scaled = scaler.transform(X_test)

with open(SCALER_OUTPUT, 'wb') as f:
    pickle.dump(scaler, f)
print(f" Scaler saved to: {SCALER_OUTPUT}")

# ============================================================
# STEP 4: Train XGBoost Model
# ============================================================
print("\n" + "=" * 60)
print(" STEP 4: Train XGBoost Classifier")
print("=" * 60)

xgb_params = {
    'n_estimators': 300,
    'max_depth': 5,
    'learning_rate': 0.05,
    'subsample': 0.8,
    'colsample_bytree': 0.8,
    'min_child_weight': 3,
    'gamma': 0.1,
    'reg_alpha': 0.1,
    'reg_lambda': 1.0,
    'random_state': RANDOM_SEED,
    'eval_metric': 'logloss',
    'early_stopping_rounds': 30,
}

print(" Hyperparameters:")
for k, v in xgb_params.items():
    print(f"  {k}: {v}")

model = xgb.XGBClassifier(**xgb_params)

eval_set = [(X_train_scaled, y_train_sm), (X_test_scaled, y_test)]
model.fit(
    X_train_scaled, y_train_sm,
    eval_set=eval_set,
    verbose=50
)

print(f"\n Best iteration: {model.best_iteration}")

with open(MODEL_OUTPUT, 'wb') as f:
    pickle.dump(model, f)
print(f" Model saved to: {MODEL_OUTPUT}")

# ============================================================
# STEP 5: Evaluate Model
# ============================================================
print("\n" + "=" * 60)
print(" STEP 5: Model Evaluation")
print("=" * 60)

y_pred = model.predict(X_test_scaled)
y_pred_proba = model.predict_proba(X_test_scaled)[:, 1]

print("\nClassification Report:")
print(classification_report(y_test, y_pred,
                             target_names=['No Failure', 'Failure'],
                             digits=4))

roc_auc = roc_auc_score(y_test, y_pred_proba)
print(f"ROC-AUC Score: {roc_auc:.4f}")

# ============================================================
# STEP 6: Plot Results
# ============================================================
print("\n" + "=" * 60)
print(" STEP 6: Generating Plots")
print("=" * 60)

fig, axes = plt.subplots(1, 3, figsize=(18, 5))

# 6a: Confusion Matrix
cm = confusion_matrix(y_test, y_pred)
disp = ConfusionMatrixDisplay(confusion_matrix=cm,
                               display_labels=['No Failure', 'Failure'])
disp.plot(ax=axes[0], colorbar=False, cmap='Blues')
axes[0].set_title('Confusion Matrix', fontweight='bold')

# 6b: ROC Curve
fpr, tpr, _ = roc_curve(y_test, y_pred_proba)
axes[1].plot(fpr, tpr, color='steelblue', lw=2, label=f'AUC = {roc_auc:.4f}')
axes[1].plot([0, 1], [0, 1], 'k--', lw=1, alpha=0.5)
axes[1].fill_between(fpr, tpr, alpha=0.15, color='steelblue')
axes[1].set_xlabel('False Positive Rate')
axes[1].set_ylabel('True Positive Rate')
axes[1].set_title('ROC Curve', fontweight='bold')
axes[1].legend(loc='lower right')

# 6c: Feature Importance
importances = model.feature_importances_
sorted_idx = np.argsort(importances)
axes[2].barh([FEATURE_COLS[i] for i in sorted_idx],
             [importances[i] for i in sorted_idx],
             color='steelblue', alpha=0.8)
axes[2].set_xlabel('Feature Importance (gain)')
axes[2].set_title('XGBoost Feature Importance', fontweight='bold')

plt.tight_layout()
fig_path = os.path.join(PLOT_DIR, 'model_evaluation.png')
plt.savefig(fig_path, dpi=150, bbox_inches='tight')
print(f" Saved evaluation plots to: {fig_path}")
plt.show()

# ============================================================
# STEP 7: SHAP Analysis (Model Explainability)
# ============================================================
print("\n" + "=" * 60)
print(" STEP 7: SHAP Explainability Analysis")
print("=" * 60)

explainer = shap.TreeExplainer(model)
shap_values = explainer.shap_values(X_test_scaled)

plt.figure(figsize=(10, 6))
shap.summary_plot(shap_values, X_test,
                  feature_names=FEATURE_COLS,
                  show=False)
plt.title('SHAP Summary Plot - Feature Impact on Failure Prediction',
          fontweight='bold')
plt.tight_layout()
shap_path = os.path.join(PLOT_DIR, 'shap_summary.png')
plt.savefig(shap_path, dpi=150, bbox_inches='tight')
print(f" Saved SHAP plot to: {shap_path}")
plt.show()

# ============================================================
# STEP 8: Cross-Validation
# ============================================================
print("\n" + "=" * 60)
print(" STEP 8: Cross-Validation (5-Fold)")
print("=" * 60)

X_full_scaled = scaler.transform(X_train)
cv_scores = cross_val_score(model, X_full_scaled, y_train, cv=5, scoring='roc_auc')

print("5-Fold Cross-Validation ROC-AUC Scores:")
for i, score in enumerate(cv_scores, 1):
    print(f"  Fold {i}: {score:.4f}")
print(f"  Mean: {cv_scores.mean():.4f} +/- {cv_scores.std():.4f}")

print("\n=== ML TRAINING COMPLETE ===")
print(f" Model saved : {MODEL_OUTPUT}")
print(f" Plots saved : {PLOT_DIR}")
