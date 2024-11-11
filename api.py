import os
import uuid
import traceback
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
import openai
import pdfplumber
import chromadb
from chromadb.config import Settings
from dotenv import load_dotenv
import logging
import json


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler()],
)
logger = logging.getLogger(__name__)

# Load environment variables from .env file
load_dotenv()

# Initialize OpenAI API
openai.api_key = os.getenv("OPENAI_API_KEY")
if not openai.api_key:
    logger.error("OPENAI_API_KEY is not set in the environment variables.")
    raise EnvironmentError("OPENAI_API_KEY not set.")

# Initialize ChromaDB with persistence
try:
    client = chromadb.Client(Settings(persist_directory="./chromadb_data"))
    if "pdf_chunks" not in client.list_collections():
        collection = client.create_collection("pdf_chunks")
        logger.info("ChromaDB collection 'pdf_chunks' created successfully.")
    else:
        collection = client.get_collection("pdf_chunks")
        logger.info("ChromaDB collection 'pdf_chunks' retrieved successfully.")
except Exception as e:
    logger.error(f"Failed to initialize ChromaDB: {str(e)}")
    raise

# Initialize FastAPI app
app = FastAPI()


def extract_pdf_content(pdf_file):
    """Extract text from a PDF file and return as a list of pages."""
    try:
        pages = []
        with pdfplumber.open(pdf_file) as pdf:
            for idx, page in enumerate(pdf.pages, start=1):
                page_text = page.extract_text()
                if page_text:
                    pages.append({"page_number": idx, "text": page_text})
        if not pages:
            raise ValueError("Empty PDF content")
        logger.info(f"Extracted {len(pages)} pages from PDF successfully.")
        return pages
    except Exception as e:
        logger.error(f"PDF extraction error: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(
            status_code=500, detail="Failed to extract content from PDF"
        )


def generate_questions(content):
    """Generate 5 questions using OpenAI's ChatCompletion API."""
    try:
        logger.info("Generating questions using OpenAI's ChatCompletion API.")
        response = openai.ChatCompletion.create(
            model="gpt-4",  # Use a suitable model like gpt-4 or gpt-3.5-turbo
            messages=[
                {
                    "role": "system",
                    "content": "You are an assistant that generates insightful questions based on provided content.",
                },
                {
                    "role": "user",
                    "content": f"Create 5 questions from the following content:\n\n{content}",
                },
            ],
            max_tokens=500,
            temperature=0.7,
        )
        # Log the full response for debugging
        logger.debug(f"OpenAI ChatCompletion Response: {response}")

        # Extract the assistant's reply
        assistant_message = response["choices"][0]["message"]["content"]
        # Split the questions by newline or numbering
        questions = [
            q.strip() for q in assistant_message.strip().split("\n") if q.strip()
        ]
        if not questions:
            raise ValueError("No questions generated.")
        logger.info("Questions generated successfully.")
        return questions
    except Exception as e:
        logger.error(f"OpenAI API error: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail="Failed to generate questions")


def create_embedding(content):
    """Generate an embedding using OpenAI's text-embedding-ada-002 model."""
    try:
        logger.info("Creating embedding using OpenAI's Embedding API.")
        response = openai.Embedding.create(
            input=content, model="text-embedding-ada-002"
        )
        embedding = response["data"][0]["embedding"]
        if len(embedding) != 1536:
            raise ValueError(f"Unexpected embedding size: {len(embedding)}")
        logger.info("Embedding created successfully.")
        return embedding
    except Exception as e:
        logger.error(f"OpenAI Embedding error: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail="Failed to generate embedding")


@app.post("/upload/")
async def upload_file(file: UploadFile = File(...)):
    """Upload a PDF file, extract content, generate questions, and store in ChromaDB."""
    logger.info(f"Received file upload request: {file.filename}")
    try:
        if file.content_type != "application/pdf":
            logger.warning(f"Invalid file type: {file.content_type}")
            raise HTTPException(status_code=400, detail="File must be a PDF.")

        # Extract content from the PDF as pages
        pages = extract_pdf_content(file.file)

        # Optionally, generate questions based on the entire content
        # Combine all pages' text
        full_content = "\n".join([page["text"] for page in pages])
        questions = generate_questions(full_content)

        # Create embeddings and prepare data for ChromaDB
        documents = []
        embeddings = []
        metadatas = []
        for page in pages:
            page_text = page["text"]
            page_number = page["page_number"]
            embedding = create_embedding(page_text)
            documents.append(page_text)
            embeddings.append(embedding)
            metadatas.append({"page_number": page_number, "filename": file.filename})

        # Store in ChromaDB
        unique_ids = [str(uuid.uuid4()) for _ in documents]
        collection.add(
            ids=unique_ids,
            documents=documents,
            embeddings=embeddings,
            metadatas=metadatas,
        )
        logger.info(f"Stored {len(documents)} page chunks in ChromaDB successfully.")

        return JSONResponse(
            {
                "message": "File processed successfully",
                "questions": questions,
                "pages_stored": len(documents),
            }
        )

    except HTTPException as http_exc:
        logger.error(f"HTTPException: {http_exc.detail}")
        raise http_exc
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail="Internal Server Error")


@app.get("/query/")
async def query_chromadb(query: str):
    """Query ChromaDB with a text input."""
    logger.info(f"Received query: {query}")
    try:
        # Query the collection to find relevant documents
        results = collection.query(
            query_texts=[query], n_results=5, include_metadata=True
        )
        logger.info("ChromaDB query executed successfully.")
        return JSONResponse(results)
    except Exception as e:
        logger.error(f"Query error: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail="Failed to query ChromaDB")
