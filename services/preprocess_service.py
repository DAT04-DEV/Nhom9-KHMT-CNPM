import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.cluster import KMeans
from datetime import datetime

class DataPreprocessor:
    """
    Module Tiền xử lý dữ liệu (Step 3) cho hệ thống phân tích thanh toán.
    Bao gồm làm sạch, tạo đặc trưng thời gian, encode và chuẩn hóa.
    """
    
    def __init__(self):
        self.scaler = StandardScaler()
        self.one_hot_encoder = OneHotEncoder(sparse_output=False, handle_unknown='ignore')
        self.is_fitted = False

    def clean_data(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Làm sạch dữ liệu: Xử lý giá trị thiếu (Null) và ngoại lai (Outliers).
        """
        df = df.copy()
        
        # 1. Xóa hoặc điền giá trị Null
        # Đối với các cột quan trọng, xóa dòng nếu thiếu
        df = df.dropna(subset=['Transaction_ID', 'User_ID', 'Timestamp', 'Amount_VND'])
        
        # Điền các cột phân loại bằng 'Unknown' nếu thiếu
        categorical_cols = ['Payment_Method', 'Merchant_Category', 'Location']
        for col in categorical_cols:
            if col in df.columns:
                df[col] = df[col].fillna('Unknown')

        # 2. Xử lý Outlier cho cột Amount_VND sử dụng phương pháp IQR
        Q1 = df['Amount_VND'].quantile(0.25)
        Q3 = df['Amount_VND'].quantile(0.75)
        IQR = Q3 - Q1
        lower_bound = Q1 - 1.5 * IQR
        upper_bound = Q3 + 3.0 * IQR  # Cho phép biên độ rộng hơn một chút cho các giao dịch lớn hợp lệ
        
        # Thay vì xóa hoàn toàn, ta có thể clip (giới hạn) giá trị để giữ lại thông tin
        df['Amount_VND'] = df['Amount_VND'].clip(lower=0, upper=upper_bound)
        
        return df

    def extract_time_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Tạo các đặc trưng thời gian: Hour, Day of Week, Month.
        """
        df = df.copy()
        if not pd.api.types.is_datetime64_any_dtype(df['Timestamp']):
            df['Timestamp'] = pd.to_datetime(df['Timestamp'])
            
        df['hour'] = df['Timestamp'].dt.hour
        df['day_of_week'] = df['Timestamp'].dt.dayofweek # 0=Monday, 6=Sunday
        df['month'] = df['Timestamp'].dt.month
        df['is_weekend'] = df['day_of_week'].apply(lambda x: 1 if x >= 5 else 0)
        
        return df

    def process(self, df: pd.DataFrame, training: bool = True) -> pd.DataFrame:
        """
        Thực hiện toàn bộ quy trình tiền xử lý.
        """
        # 1. Làm sạch
        df = self.clean_data(df)
        
        # 2. Đặc trưng thời gian
        df = self.extract_time_features(df)
        
        # 3. Chuẩn hóa Amount_VND
        if training:
            df['amount_scaled'] = self.scaler.fit_transform(df[['Amount_VND']])
        else:
            df['amount_scaled'] = self.scaler.transform(df[['Amount_VND']])
            
        # 4. Encode các cột phân loại (One-hot)
        # Lưu ý: Trong thực tế ML, ta thường trả về matrix, 
        # nhưng ở đây ta trả về DF có kèm cột đã encode để dễ quan sát.
        encode_cols = ['Payment_Method', 'Merchant_Category']
        
        if training:
            encoded_data = self.one_hot_encoder.fit_transform(df[encode_cols])
        else:
            encoded_data = self.one_hot_encoder.transform(df[encode_cols])
            
        encoded_df = pd.DataFrame(
            encoded_data, 
            columns=self.one_hot_encoder.get_feature_names_out(encode_cols),
            index=df.index
        )
        
        return pd.concat([df, encoded_df], axis=1)

class CustomerSegmenter:
    """
    Module Phân khúc khách hàng sử dụng thuật toán K-Means Cluster.
    """
    
    def __init__(self, n_clusters=4):
        self.n_clusters = n_clusters
        self.kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
        self.scaler = StandardScaler()

    def _prepare_rfm_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Chuyển đổi dữ liệu giao dịch thành dữ liệu RFM (Recency, Frequency, Monetary).
        """
        # Giả định ngày hiện tại là ngày cuối cùng trong dữ liệu + 1
        current_date = df['Timestamp'].max() + pd.Timedelta(days=1)
        
        rfm = df.groupby('User_ID').agg({
            'Timestamp': lambda x: (current_date - x.max()).days, # Recency
            'Transaction_ID': 'count',                             # Frequency
            'Amount_VND': 'sum'                                   # Monetary
        }).reset_index()
        
        rfm.columns = ['User_ID', 'Recency', 'Frequency', 'Monetary']
        return rfm

    def cluster_customers(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Thực hiện phân cụm khách hàng.
        """
        # 1. Chuẩn bị dữ liệu RFM
        rfm_df = self._prepare_rfm_features(df)
        
        # 2. Chuẩn hóa dữ liệu trước khi clustering (rất quan trọng với K-Means)
        features = ['Recency', 'Frequency', 'Monetary']
        rfm_scaled = self.scaler.fit_transform(rfm_df[features])
        
        # 3. Chạy K-Means
        rfm_df['Cluster'] = self.kmeans.fit_predict(rfm_scaled)
        
        # 4. Gán tên nhãn thân thiện cho các nhóm (tùy thuộc vào centroid)
        # Ở đây ta sử dụng logic đơn giản dựa trên Monetary để đặt tên
        cluster_avg_monetary = rfm_df.groupby('Cluster')['Monetary'].mean().sort_values()
        
        cluster_mapping = {}
        names = ["Người dùng mới/Ít hoạt động", "Khách hàng phổ thông", "Khách hàng tiềm năng", "Khách hàng VIP"]
        
        for i, cluster_id in enumerate(cluster_avg_monetary.index):
            cluster_mapping[cluster_id] = names[min(i, len(names)-1)]
            
        rfm_df['Segment_Name'] = rfm_df['Cluster'].map(cluster_mapping)
        
        return rfm_df
