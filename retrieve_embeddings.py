import os
import chromadb
from chromadb.config import Settings
import json
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler()],
)
logger = logging.getLogger(__name__)

# Initialize ChromaDB client
try:
    client = chromadb.Client(Settings(persist_directory="./chromadb_data"))
    collection = client.get_collection("pdf_chunks")
    logger.info("Connected to ChromaDB collection 'pdf_chunks'.")
except Exception as e:
    logger.error(f"Failed to connect to ChromaDB: {str(e)}")
    raise


def retrieve_embeddings():
    """Retrieve and display all embeddings with their metadata from ChromaDB."""
    try:
        # Query all documents without any filtering
        results = collection.get(
            include=["ids", "documents", "embeddings", "metadatas"],
            where={},  # Empty filter to get all documents
        )

        ids = results["ids"]
        documents = results["documents"]
        embeddings = results["embeddings"]
        metadatas = results["metadatas"]

        for idx, doc_id in enumerate(ids):
            print(f"Document ID: {doc_id}")
            print(f"Filename: {metadatas[idx].get('filename', 'N/A')}")
            print(f"Page Number: {metadatas[idx].get('page_number', 'N/A')}")
            print(
                f"Content Snippet: {documents[idx][:200]}..."
            )  # Print first 200 chars
            print(
                f"Embedding (first 5 values): {embeddings[idx][:5]}..."
            )  # Print first 5 elements
            print("-" * 80)

        logger.info(f"Retrieved and displayed {len(ids)} embeddings successfully.")

    except Exception as e:
        logger.error(f"Error retrieving embeddings: {str(e)}")
        raise


if __name__ == "__main__":
    retrieve_embeddings()
