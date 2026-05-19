import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.metrics import classification_report, confusion_matrix
from pathlib import Path

class FraudDetectorService:
    def __init__(self, csv_path: Path):
        self.csv_path = csv_path
        self.active_model = "decision_tree"
        self.dt_pipeline = None
        self.rf_pipeline = None
        self.feature_names = None
        self.dt_metrics = {}
        self.rf_metrics = {}
        self.dt_is_trained = False
        self.rf_is_trained = False

    def train_decision_tree(self):
        try:
            if not self.csv_path.exists():
                return False

            df = pd.read_csv(self.csv_path)
            df = self._preprocess_dataframe(df)

            # Features and target
            features = ["Amount_VND", "Hour", "Is_Weekend", "Payment_Method", "Merchant_Category", "Location"]
            X = df[features]
            y = df["Is_Fraud"]

            # Train/test split
            X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

            # Setup preprocessor
            categorical_features = ["Payment_Method", "Merchant_Category", "Location"]
            preprocessor = ColumnTransformer(
                transformers=[
                    ('cat', OneHotEncoder(handle_unknown='ignore', sparse_output=False), categorical_features)
                ],
                remainder='passthrough'
            )

            # Initialize and fit
            dt_classifier = DecisionTreeClassifier(max_depth=4, random_state=42)
            self.dt_pipeline = Pipeline(steps=[
                ('preprocessor', preprocessor),
                ('classifier', dt_classifier)
            ])
            self.dt_pipeline.fit(X_train, y_train)

            # Retrieve feature names
            cat_encoder = self.dt_pipeline.named_steps['preprocessor'].named_transformers_['cat']
            cat_features_encoded = list(cat_encoder.get_feature_names_out(categorical_features))
            self.feature_names = cat_features_encoded + ["Amount_VND", "Hour", "Is_Weekend"]

            # Evaluate
            dt_pred = self.dt_pipeline.predict(X_test)
            dt_report = classification_report(y_test, dt_pred, output_dict=True, zero_division=0)
            dt_cm = confusion_matrix(y_test, dt_pred).tolist()

            self.dt_metrics = {
                "accuracy": dt_report["accuracy"],
                "precision": dt_report["weighted avg"]["precision"],
                "recall": dt_report["weighted avg"]["recall"],
                "f1_score": dt_report["weighted avg"]["f1-score"],
                "confusion_matrix": dt_cm,
                "total_samples": len(df),
                "fraud_samples": int((df["Is_Fraud"] == 1).sum()),
                "normal_samples": int((df["Is_Fraud"] == 0).sum())
            }
            self.dt_is_trained = True
            return True

        except Exception as e:
            print(f"Error training Decision Tree model: {e}")
            self.dt_is_trained = False
            return False

    def train_random_forest(self):
        try:
            if not self.csv_path.exists():
                return False

            df = pd.read_csv(self.csv_path)
            df = self._preprocess_dataframe(df)

            # Features and target
            features = ["Amount_VND", "Hour", "Is_Weekend", "Payment_Method", "Merchant_Category", "Location"]
            X = df[features]
            y = df["Is_Fraud"]

            # Train/test split
            X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

            # Setup preprocessor
            categorical_features = ["Payment_Method", "Merchant_Category", "Location"]
            preprocessor = ColumnTransformer(
                transformers=[
                    ('cat', OneHotEncoder(handle_unknown='ignore', sparse_output=False), categorical_features)
                ],
                remainder='passthrough'
            )

            # Initialize and fit
            rf_classifier = RandomForestClassifier(n_estimators=50, max_depth=4, random_state=42)
            self.rf_pipeline = Pipeline(steps=[
                ('preprocessor', preprocessor),
                ('classifier', rf_classifier)
            ])
            self.rf_pipeline.fit(X_train, y_train)

            # Retrieve feature names if not already retrieved
            if self.feature_names is None:
                cat_encoder = self.rf_pipeline.named_steps['preprocessor'].named_transformers_['cat']
                cat_features_encoded = list(cat_encoder.get_feature_names_out(categorical_features))
                self.feature_names = cat_features_encoded + ["Amount_VND", "Hour", "Is_Weekend"]

            # Evaluate
            rf_pred = self.rf_pipeline.predict(X_test)
            rf_report = classification_report(y_test, rf_pred, output_dict=True, zero_division=0)
            rf_cm = confusion_matrix(y_test, rf_pred).tolist()

            self.rf_metrics = {
                "accuracy": rf_report["accuracy"],
                "precision": rf_report["weighted avg"]["precision"],
                "recall": rf_report["weighted avg"]["recall"],
                "f1_score": rf_report["weighted avg"]["f1-score"],
                "confusion_matrix": rf_cm,
                "total_samples": len(df),
                "fraud_samples": int((df["Is_Fraud"] == 1).sum()),
                "normal_samples": int((df["Is_Fraud"] == 0).sum())
            }
            self.rf_is_trained = True
            return True

        except Exception as e:
            print(f"Error training Random Forest model: {e}")
            self.rf_is_trained = False
            return False

    def _preprocess_dataframe(self, df):
        # Map values to Vietnamese to match the dashboard naming conventions
        category_mapping = {
            "Transport": "Giao thông & Di chuyển",
            "Utilities": "Điện nước & Tiện ích",
            "Supermarket": "Siêu thị",
            "Shopping": "Mua sắm",
            "Food & Beverage": "Ăn uống",
        }
        if "Merchant_Category" in df.columns:
            df["Merchant_Category"] = df["Merchant_Category"].map(category_mapping).fillna(df["Merchant_Category"])
        if "Payment_Method" in df.columns:
            df["Payment_Method"] = df["Payment_Method"].replace({"E-Wallet": "Ví điện tử"})

        # Data cleaning
        df["Amount_VND"] = pd.to_numeric(df["Amount_VND"], errors="coerce").fillna(0)
        df["Is_Fraud"] = pd.to_numeric(df["Is_Fraud"], errors="coerce").fillna(0).astype(int)
        df["Hour"] = pd.to_numeric(df["Hour"], errors="coerce").fillna(12).astype(int)
        df["Is_Weekend"] = pd.to_numeric(df["Is_Weekend"], errors="coerce").fillna(0).astype(int)
        return df

    def predict(self, model_name: str, amount: float, hour: int, is_weekend: int, payment_method: str, merchant_category: str, location: str) -> dict:
        pipeline = self.dt_pipeline if model_name == "decision_tree" else self.rf_pipeline
        is_trained = self.dt_is_trained if model_name == "decision_tree" else self.rf_is_trained

        if not is_trained or pipeline is None:
            return {"is_fraud": 0, "probability": 0.0, "rules": ["Mô hình chưa được huấn luyện."]}

        # Create DataFrame for single prediction input
        input_data = pd.DataFrame([{
            "Amount_VND": amount,
            "Hour": hour,
            "Is_Weekend": is_weekend,
            "Payment_Method": payment_method,
            "Merchant_Category": merchant_category,
            "Location": location
        }])

        # Perform prediction and retrieve prediction probabilities
        pred = int(pipeline.predict(input_data)[0])
        prob = float(pipeline.predict_proba(input_data)[0][1])

        # Extract explanation / decision rules for this specific prediction
        rules = self._get_decision_path_rules(pipeline, input_data)

        return {
            "is_fraud": pred,
            "probability": prob,
            "rules": rules
        }

    def _get_decision_path_rules(self, pipeline, input_df) -> list[str]:
        """
        Traverse the trained decision tree path for the input sample to extract specific rules.
        For Random Forest, we traverse the first tree estimator as a representative explanation path.
        """
        try:
            preprocessor = pipeline.named_steps['preprocessor']
            classifier = pipeline.named_steps['classifier']

            # If it is Random Forest, extract the first decision tree estimator
            if hasattr(classifier, 'estimators_'):
                classifier = classifier.estimators_[0]

            # Transform the single sample using the preprocessor pipeline
            X_trans = preprocessor.transform(input_df)

            # Get decision path node indices
            node_indicator = classifier.decision_path(X_trans)
            leaf_id = classifier.apply(X_trans)[0]

            # Tree attributes
            feature = classifier.tree_.feature
            threshold = classifier.tree_.threshold

            sample_id = 0
            node_index = node_indicator.indices[node_indicator.indptr[sample_id]:node_indicator.indptr[sample_id + 1]]

            rules = []
            for node_id in node_index:
                # Continue if it is a leaf node
                if leaf_id == node_id:
                    continue

                feat_idx = feature[node_id]
                feat_name = self.feature_names[feat_idx]
                thresh = threshold[node_id]

                # Map transformed feature names back to readable descriptions
                readable_feat = feat_name
                is_cat = False
                val_repr = ""

                # Example feature name: cat_Payment_Method_Ví điện tử
                if feat_name.startswith("cat_"):
                    is_cat = True
                    parts = feat_name.split("_")
                    # parts will be ['cat', 'FieldName', 'Value']
                    field_name = parts[1]
                    field_value = "_".join(parts[2:])
                    readable_feat = f"Hình thức {field_name}"
                    if field_name == "Payment_Method":
                        readable_feat = "Hình thức thanh toán"
                    elif field_name == "Merchant_Category":
                        readable_feat = "Danh mục ngành hàng"
                    elif field_name == "Location":
                        readable_feat = "Tỉnh/Thành phố"
                    val_repr = field_value

                # Evaluate test condition for this sample
                val = X_trans[sample_id, feat_idx]
                
                if is_cat:
                    # Categorical feature behaves as 1 (True) or 0 (False)
                    if val <= thresh:
                        rules.append(f"Không thanh toán bằng {val_repr}")
                    else:
                        rules.append(f"Thanh toán bằng {val_repr}")
                else:
                    # Numerical feature
                    if readable_feat == "Amount_VND":
                        readable_feat = "Số tiền giao dịch"
                        formatted_thresh = f"{int(thresh):,}"
                        if val <= thresh:
                            rules.append(f"{readable_feat} ≤ {formatted_thresh} đ")
                        else:
                            rules.append(f"{readable_feat} > {formatted_thresh} đ")
                    elif readable_feat == "Hour":
                        readable_feat = "Giờ giao dịch"
                        if val <= thresh:
                            rules.append(f"{readable_feat} ≤ {int(thresh)}h")
                        else:
                            rules.append(f"{readable_feat} > {int(thresh)}h")
                    elif readable_feat == "Is_Weekend":
                        readable_feat = "Ngày cuối tuần"
                        if val <= thresh:
                            rules.append("Giao dịch trong tuần")
                        else:
                            rules.append("Giao dịch vào cuối tuần")

            return rules

        except Exception as e:
            return [f"Không thể trích xuất quy luật quyết định: {e}"]
