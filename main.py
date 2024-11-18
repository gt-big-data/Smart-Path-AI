# main.py


import os
import uuid
import traceback
import logging
from typing import List, Dict


from fastapi import FastAPI, UploadFile, File, HTTPException, Query
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware


from langchain.document_loaders import PyPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.embeddings import OpenAIEmbeddings
from langchain.vectorstores import Chroma
from langchain.chains import RetrievalQA
from langchain_community.chat_models import ChatOpenAI
from dotenv import load_dotenv


# Load environment variables from .env file
load_dotenv()


import openai


# Initialize FastAPI app
app = FastAPI(
   title="SmartPathAI Backend",
   description="API for uploading PDFs, generating questions, and querying data using LangChain and ChromaDB.",
   version="1.0.0"
)


# Configure CORS
# Update the allowed origins in production for security
app.add_middleware(
   CORSMiddleware,
   allow_origins=["*"],  # Replace with specific origins like ["http://localhost:8501"] in production
   allow_credentials=True,
   allow_methods=["*"],
   allow_headers=["*"],
)


# Configure logging
logging.basicConfig(
   level=logging.INFO,
   format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
   handlers=[
       logging.StreamHandler()
   ]
)
logger = logging.getLogger(__name__)


# Ensure OpenAI API key is set
openai_api_key = os.getenv("OPENAI_API_KEY")
if not openai_api_key:
   logger.error("OpenAI API key not found. Please set the OPENAI_API_KEY environment variable.")
   raise EnvironmentError("OpenAI API key not found. Please set the OPENAI_API_KEY environment variable.")


openai.api_key = openai_api_key


# Initialize OpenAI embeddings
embeddings = OpenAIEmbeddings(openai_api_key=openai_api_key)


# Define the persist directory for ChromaDB
PERSIST_DIRECTORY = "./chromadb_data"


# Ensure the persist directory exists
os.makedirs(PERSIST_DIRECTORY, exist_ok=True)


def generate_questions(content: str) -> List[str]:
   """
   Generate five insightful questions based on the provided content using OpenAI's GPT-4.


   Args:
       content (str): The text content extracted from the PDF.


   Returns:
       List[str]: A list of generated questions.
   """
   prompt = (
       "Read the following text and generate five insightful questions based on the content:\n\n"
       f"{content}"
   )


   try:
       response = openai.ChatCompletion.create(
           model="gpt-4",
           messages=[
               {
                   "role": "system",
                   "content": "You are an AI that generates insightful questions based on provided content."
               },
               {
                   "role": "user",
                   "content": prompt
               }
           ],
           max_tokens=500,
           n=1,
           stop=None,
           temperature=0.7,
       )


       questions_text = response.choices[0].message['content'].strip()
       questions = [q.strip() for q in questions_text.split('\n') if q.strip()]
       questions = list(dict.fromkeys(questions))  # Remove duplicates while preserving order
       logger.info(f"Generated Questions: {questions}")  # Log generated questions
       return questions[:5]  # Ensure only five questions are returned
   except Exception as e:
       logger.error(f"Error generating questions: {str(e)}")
       raise HTTPException(status_code=500, detail="Failed to generate questions.")




@app.post("/upload/", response_class=JSONResponse)
async def upload_file(file: UploadFile = File(...)):
   """
   Upload a PDF file, extract content, generate questions, and store in ChromaDB.


   Parameters:
       file (UploadFile): The PDF file to upload.


   Returns:
       JSON response containing a message, list of generated questions, and the number of pages stored.
   """
   logger.info(f"Received file upload request: {file.filename}")
   temp_file_path = f"/tmp/{uuid.uuid4()}.pdf"


   try:
       # Validate file type
       if file.content_type != "application/pdf":
           logger.warning(f"Invalid file type: {file.content_type}")
           return JSONResponse(status_code=400, content={"detail": "File must be a PDF."})


       # Save the uploaded file to a temporary location
       with open(temp_file_path, "wb") as temp_file:
           content = await file.read()
           temp_file.write(content)
       logger.info(f"File saved to temporary path: {temp_file_path}")


       # Load and split the PDF using LangChain
       loader = PyPDFLoader(temp_file_path)
       documents = loader.load()
       logger.info(f"Loaded {len(documents)} documents from PDF.")


       text_splitter = RecursiveCharacterTextSplitter(
           chunk_size=1000,
           chunk_overlap=200
       )
       docs = text_splitter.split_documents(documents)
       logger.info(f"Split documents into {len(docs)} chunks.")


       # Initialize or load the vector store
       if os.path.exists(PERSIST_DIRECTORY) and os.listdir(PERSIST_DIRECTORY):
           vectorstore = Chroma(
               persist_directory=PERSIST_DIRECTORY,
               embedding_function=embeddings
           )
           vectorstore.add_documents(docs)
           logger.info("Documents added to existing ChromaDB vector store.")
       else:
           vectorstore = Chroma.from_documents(
               docs,
               embeddings,
               persist_directory=PERSIST_DIRECTORY
           )
           logger.info("ChromaDB vector store created and documents added.")


       # Persist the vector store
       # vectorstore.persist()
       # logger.info("ChromaDB vector store persisted.")


       # Generate questions based on the entire content
       full_content = "\n".join([doc.page_content for doc in docs])
       questions = generate_questions(full_content)
       logger.info(f"Generated {len(questions)} questions.")


       return JSONResponse(
           {
               "message": "File processed successfully",
               "questions": questions,
               "pages_stored": len(docs),
           }
       )


   except HTTPException as http_exc:
       logger.error(f"HTTPException: {http_exc.detail}")
       return JSONResponse(status_code=http_exc.status_code, content={"detail": http_exc.detail})


   except Exception as e:
       logger.error(f"Unexpected error: {str(e)}\n{traceback.format_exc()}")
       return JSONResponse(status_code=500, content={"detail": "Internal Server Error"})


   finally:
       # Clean up the temporary file
       if os.path.exists(temp_file_path):
           os.remove(temp_file_path)
           logger.info(f"Temporary file {temp_file_path} removed.")


@app.get("/query/", response_class=JSONResponse)
async def query_chromadb(query: str = Query(..., min_length=1)):
   """
   Query ChromaDB using LangChain's RetrievalQA chain.


   Parameters:
       query (str): The user's query string.


   Returns:
       JSON response containing the answer and source documents.
   """
   logger.info(f"Received query: {query}")


   try:
       # Load the persisted vector store
       vectorstore = Chroma(
           persist_directory=PERSIST_DIRECTORY,
           embedding_function=embeddings
       )
       logger.info("ChromaDB vector store loaded.")


       # Set up the RetrievalQA chain
       qa_chain = RetrievalQA.from_chain_type(
           llm=ChatOpenAI(model_name="gpt-4", temperature=0, api_key=openai_api_key),
           chain_type="stuff",
           retriever=vectorstore.as_retriever(),
           return_source_documents=True,
       )
       logger.info("RetrievalQA chain initialized.")


       # Run the query through the chain
       result = qa_chain.invoke({"query": query})
       logger.info("Query processed successfully.")


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


       return JSONResponse(response)


   except Exception as e:
       logger.error(f"Query error: {str(e)}\n{traceback.format_exc()}")
       return JSONResponse(status_code=500, content={"detail": "Failed to process the query."})


