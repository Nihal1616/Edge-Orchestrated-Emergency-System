import numpy as np

class SimpleTrafficModel:
    def predict(self, X):
        # Simple prediction based on distance and traffic level
        if hasattr(X, 'shape'):
            # Assume X is array-like
            if len(X.shape) == 1:
                distance = X[0] if len(X) > 0 else 5
                traffic_level = X[1] if len(X) > 1 else 3
            else:
                distance = X[:, 0] if X.shape[1] > 0 else np.full(X.shape[0], 5)
                traffic_level = X[:, 1] if X.shape[1] > 1 else np.full(X.shape[0], 3)
        else:
            distance = 5
            traffic_level = 3

        # Simple formula: base time + distance factor + traffic factor
        base_time = 5  # 5 minutes base
        distance_factor = distance * 2  # 2 minutes per km
        traffic_factor = traffic_level * 3  # 3 minutes per traffic level

        return base_time + distance_factor + traffic_factor

class SimpleScaler:
    def transform(self, X):
        return X
    def inverse_transform(self, X):
        return X