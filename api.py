import sys
import pydantic

print(f"Pydantic version: {pydantic.__version__}")
print(f"Python executable: {sys.executable}")

import os
import re
import tiktoken
import uuid
import traceback
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
import openai
from dotenv import load_dotenv
import logging
import json

# Updated imports from langchain-community
from langchain.document_loaders import PyPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.embeddings import OpenAIEmbeddings
from langchain.vectorstores import Chroma
from langchain.llms import OpenAI
from langchain.chains import RetrievalQA

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

# Initialize FastAPI app
app = FastAPI()


def generate_questions(content):
    """Generate 5 questions using OpenAI's ChatCompletion API."""
    try:
        logger.info("Generating questions using OpenAI's ChatCompletion API.")

        # Initialize tiktoken encoder for the model
        encoding = tiktoken.encoding_for_model("gpt-4")

        # Calculate available tokens
        max_model_tokens = 8192
        reserve_tokens = 700  # For response and message overhead
        max_content_tokens = max_model_tokens - reserve_tokens

        # Encode the content and truncate if necessary
        content_tokens = encoding.encode(content)
        if len(content_tokens) > max_content_tokens:
            logger.info(f"Content exceeds {max_content_tokens} tokens. Truncating.")
            content_tokens = content_tokens[:max_content_tokens]
            content = encoding.decode(content_tokens)

        response = openai.ChatCompletion.create(
            model="gpt-4",
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
        logger.info(f"Assistant's message: {assistant_message}")

        # Use regex to extract questions
        pattern = r"^\d+\.\s*(.*)$"  # Matches lines like '1. Question text'
        matches = re.findall(pattern, assistant_message, re.MULTILINE)
        if matches:
            questions = [match.strip() for match in matches]
        else:
            # If numbering not used, split by lines
            questions = [
                q.strip("-").strip()
                for q in assistant_message.strip().split("\n")
                if q.strip()
            ]

        logger.info(f"Extracted questions: {questions}")

        if not questions:
            raise ValueError("No questions generated.")
        logger.info("Questions generated successfully.")
        return questions
    except Exception as e:
        logger.error(f"OpenAI API error: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail="Failed to generate questions")


@app.post("/upload/")
async def upload_file(file: UploadFile = File(...)):
    """Upload a PDF file, extract content, generate questions, and store in ChromaDB using LangChain."""
    logger.info(f"Received file upload request: {file.filename}")
    temp_file_path = f"/tmp/{uuid.uuid4()}.pdf"
    try:
        if file.content_type != "application/pdf":
            logger.warning(f"Invalid file type: {file.content_type}")
            raise HTTPException(status_code=400, detail="File must be a PDF.")

        # Save the uploaded file to a temporary location
        with open(temp_file_path, "wb") as temp_file:
            content = await file.read()
            temp_file.write(content)

        # Load and split the PDF using LangChain
        loader = PyPDFLoader(temp_file_path)
        documents = loader.load()

        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000, chunk_overlap=200
        )
        docs = text_splitter.split_documents(documents)

        # Initialize embeddings and vector store
        embeddings = OpenAIEmbeddings()
        persist_directory = "./chromadb_data"

        # Create or load the vector store
        if os.path.exists(persist_directory):
            vectorstore = Chroma(
                persist_directory=persist_directory, embedding_function=embeddings
            )
            vectorstore.add_documents(docs)
            logger.info("Documents added to existing ChromaDB vector store.")
        else:
            vectorstore = Chroma.from_documents(
                docs, embeddings, persist_directory=persist_directory
            )
            logger.info("ChromaDB vector store created and documents added.")

        # Persist the vector store
        vectorstore.persist()

        # Optionally, generate questions based on the entire content
        full_content = "\n".join([doc.page_content for doc in docs])
        questions = generate_questions(full_content)

        return JSONResponse(
            {
                "message": "File processed successfully",
                "questions": questions,
                "pages_stored": len(docs),
            }
        )

    except HTTPException as http_exc:
        logger.error(f"HTTPException: {http_exc.detail}")
        raise http_exc
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail="Internal Server Error")
    finally:
        # Clean up the temporary file
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)


@app.get("/query/")
async def query_chromadb(query: str):
    """Query ChromaDB using LangChain's RetrievalQA chain."""
    logger.info(f"Received query: {query}")
    try:
        # Initialize embeddings and vector store
        embeddings = OpenAIEmbeddings()
        persist_directory = "./chromadb_data"

        # Load the persisted vector store
        vectorstore = Chroma(
            persist_directory=persist_directory, embedding_function=embeddings
        )

        # Set up the RetrievalQA chain
        qa_chain = RetrievalQA.from_chain_type(
            llm=OpenAI(model_name="gpt-4", temperature=0),
            chain_type="stuff",
            retriever=vectorstore.as_retriever(),
            return_source_documents=True,
        )

        # Run the query through the chain
        result = qa_chain({"query": query})

        # Extract the answer and source documents
        answer = result["result"]
        source_documents = result["source_documents"]

        # Prepare the response
        response = {
            "answer": answer,
            "sources": [
                {
                    "page_content": doc.page_content,
                    "metadata": doc.metadata,
                }
                for doc in source_documents
            ],
        }

        logger.info("Query processed successfully.")
        return JSONResponse(response)

    except Exception as e:
        logger.error(f"Query error: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail="Failed to process the query")
