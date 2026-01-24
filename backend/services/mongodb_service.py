from pymongo import MongoClient
from pymongo.errors import ServerSelectionTimeoutError
from config import MONGODB_URL
from typing import List, Dict, Any
from bson import ObjectId

class MongoDBService:
    def __init__(self):
        try:
            self.client = MongoClient(MONGODB_URL, serverSelectionTimeoutMS=5000)
            # Vérifier la connexion
            self.client.admin.command('ping')
            self.db = self.client.get_database("DeepMinds")
            self.products_collection = self.db.products
            print("✅ Connecté à MongoDB")
        except ServerSelectionTimeoutError:
            print("❌ Impossible de se connecter à MongoDB")
            raise

    def insert_product(self, product_data: Dict[str, Any]) -> str:
        """Insérer un produit dans MongoDB et retourner son ID"""
        result = self.products_collection.insert_one(product_data)
        return str(result.inserted_id)

    def update_product(self, product_id: str, update_data: Dict[str, Any]) -> bool:
        """Mettre à jour un produit"""
        result = self.products_collection.update_one(
            {"_id": ObjectId(product_id)},
            {"$set": update_data}
        )
        return result.modified_count > 0

    def get_product(self, product_id: str) -> Dict[str, Any]:
        """Récupérer un produit par ID"""
        product = self.products_collection.find_one({"_id": ObjectId(product_id)})
        if product:
            product["_id"] = str(product["_id"])
        return product

    def get_all_products(self) -> List[Dict[str, Any]]:
        """Récupérer tous les produits"""
        products = list(self.products_collection.find())
        for product in products:
            product["_id"] = str(product["_id"])
        return products

    def delete_product(self, product_id: str) -> bool:
        """Supprimer un produit"""
        result = self.products_collection.delete_one({"_id": ObjectId(product_id)})
        return result.deleted_count > 0

    def close(self):
        """Fermer la connexion MongoDB"""
        self.client.close()

# Instance globale
mongo_service = MongoDBService()
