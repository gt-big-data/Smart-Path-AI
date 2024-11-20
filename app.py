import requests
import streamlit as st
# from streamlit_lottie import st_lottie
import uuid
import os
import json

# Define your backend URL
BACKEND_URL = "http://localhost:8509"  # Ensure this matches your backend port

st.set_page_config(
    page_title="SmartPathAI Website",
    page_icon="🧠",
    layout="wide"
)

# def load_lottieurl(url):
#     r = requests.get(url)
#     if r.status_code != 200:
#         return None
#     return r.json()

# lottie_coding = load_lottieurl("https://lottie.host/2021bcc3-70ad-4e1c-b919-eb0cbd2b2fd3/bgpv9Cb4Lt.json")

# --- HEADER SECTION ---
with st.container():
    st.subheader("Welcome to SmartPathAI 👋")
    st.title("Your AI-powered Online Assistant for Academic Studies")
    st.write("We are currently in beta and are working on adding more features to our website. Stay tuned for more updates!")

with st.container():
    st.write("---")
    left_column, right_column = st.columns(2)
    
    with left_column:
        st.header("Get Any Answer with Our AI Assistant")
        st.write("Upload a PDF document, get generated questions, and interact with our AI to find answers.")
        
        # Initialize session state variables
        if 'questions' not in st.session_state:
            st.session_state['questions'] = []
        if 'processed_files' not in st.session_state:
            st.session_state['processed_files'] = []
        
        # File uploader inside a form
        with st.form(key='upload_form'):
            uploaded_files = st.file_uploader("Upload PDF Files", type=["pdf"], accept_multiple_files=True)
            submit_button = st.form_submit_button(label='Upload and Process')
        
        if submit_button:
            if not uploaded_files:
                st.warning("Please upload at least one PDF file.")
            else:
                for uploaded_file in uploaded_files:
                    if uploaded_file.name in st.session_state['processed_files']:
                        st.info(f"Already processed {uploaded_file.name}. Skipping.")
                        continue
                    files = {"file": (uploaded_file.name, uploaded_file, "application/pdf")}
                    try:
                        st.info(f"Uploading {uploaded_file.name}...")
                        response = requests.post(f"{BACKEND_URL}/upload/", files=files, timeout=120)  # Increased timeout
                        st.info(f"Received response for {uploaded_file.name}: {response.status_code}")
                        if response.status_code == 200:
                            data = response.json()
                            st.success(f"Successfully processed {uploaded_file.name}")
                            questions = data.get("questions", [])
                            if questions:
                                st.session_state['processed_files'].append(uploaded_file.name)
                                st.session_state['questions'].extend(questions)
                                # Remove duplicates
                                st.session_state['questions'] = list(dict.fromkeys(st.session_state['questions']))
                        else:
                            # Enhanced error handling
                            try:
                                error_detail = response.json().get("detail", "Unknown error")
                            except json.JSONDecodeError:
                                error_detail = response.text or "Unknown error"
                            st.error(f"Failed to process {uploaded_file.name}: {error_detail}")
                    except requests.exceptions.Timeout:
                        st.error(f"Request timed out while uploading {uploaded_file.name}.")
                    except Exception as e:
                        st.error(f"An error occurred while uploading {uploaded_file.name}: {str(e)}")
        
        # Display questions after processing
        if st.session_state['questions']:
            questions_md = "\n".join([f"{idx + 1}. {question}" for idx, question in enumerate(st.session_state['questions'])])
            st.markdown(f"**Generated Questions:**\n\n{questions_md}")

    # with right_column:
    #     st_lottie(lottie_coding, height=300, key="coding")
        
# --- CHATBOT SECTION ---
st.write("---")
st.header("Chat with Your AI Assistant")

# Initialize chat history in session state if not present
if 'chat_history' not in st.session_state:
    st.session_state['chat_history'] = []

# Display chat history
for chat in st.session_state['chat_history']:
    if chat['role'] == 'user':
        st.markdown(f"**You:** {chat['content']}")
    else:
        st.markdown(f"**AI:** {chat['content']}")

# Create a form for user input
with st.form(key='chat_form', clear_on_submit=True):
    user_input = st.text_input("You:", placeholder="Type your message here...")
    submit_chat = st.form_submit_button(label='Send')

# Handle form submission
if submit_chat and user_input:
    # Append user's message to chat history
    st.session_state['chat_history'].append({"role": "user", "content": user_input})

    # Display user's message
    st.markdown(f"**You:** {user_input}")

    # Send the query to the backend
    try:
        with st.spinner("AI is typing..."):
            params = {"query": user_input}
            response = requests.get(f"{BACKEND_URL}/query/", params=params, timeout=120)  # Increased timeout
            if response.status_code == 200:
                data = response.json()
                answer = data.get("answer", "No answer found.")
                sources = data.get("sources", [])

                # Append AI's answer to chat history
                st.session_state['chat_history'].append({"role": "assistant", "content": answer})

                # Display AI's answer
                st.markdown(f"**AI:** {answer}")

                # Optionally, display sources
                if sources:
                    with st.expander("View Sources"):
                        for idx, source in enumerate(sources, 1):
                            st.write(f"**Source {idx}:**")
                            st.write(source.get("page_content", ""))
                            st.write(f"*Metadata:* {source.get('metadata', {})}")
            else:
                # Handle error responses
                try:
                    error_detail = response.json().get("detail", "Failed to get a response from the server.")
                except json.JSONDecodeError:
                    error_detail = response.text or "Failed to get a response from the server."
                st.markdown(f"**AI:** {error_detail}")
    except requests.exceptions.Timeout:
        st.markdown("**AI:** Request timed out while processing your query.")
    except Exception as e:
        st.markdown(f"**AI:** An error occurred: {str(e)}")
