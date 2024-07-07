from flask import Flask, request, render_template, jsonify 
import traceback
from openai import OpenAI
from pymongo import MongoClient
from flask_bcrypt import Bcrypt
from bson import ObjectId
import datetime
import json
import os
import requests
from google.cloud import storage    
from flask import Flask, request, jsonify, send_from_directory


app = Flask(__name__)
openai_client = OpenAI("")  # Ensure this is securely handled

bcrypt = Bcrypt(app)
mongo_client = MongoClient('')
db = mongo_client.your_database
users = db.users
flashcards = db.flashcards

def load_prompt(figure_name):
    try:
        with open(f'prompts/{figure_name}.txt', 'r', encoding='utf-8') as file:
            return file.read()
    except FileNotFoundError:
        return None

@app.route('/')
def home():
    return render_template('chat.html')

def create_prompt(character, user_input):
    return f"As {character}, answer the following question: {user_input}"

@app.route('/ask', methods=['POST'])
def ask():
    user_input = request.form['question']
    figure = request.form['figure'].strip()
    email = request.form['email']
    character_type = request.form['characterType']

    if not user_input or not figure or not email:
        return jsonify({'error': 'Missing data'}), 400
    
    if character_type == 'Any':
        # Validate if the character is a historical figure
        prompt_validation = f"Is {figure} a real historical figure?"
        try:
            validation_response = openai_client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[{"role": "user", "content": prompt_validation}]
            )
            validation_content = validation_response.choices[0].message.content.strip().lower()
            if "yes" in validation_content:
                prompt = f"As {figure}, answer the following question: {user_input}"
            else:
                return jsonify({'error': f'{figure} is not a known historical figure.'}), 400
        except Exception as e:
            app.logger.error('Error validating character: {}'.format(str(e)))
            return jsonify({'error': 'Error validating character.'}), 500
    else:
        prompt = load_prompt(figure)
        if not prompt:
            return jsonify({'error': f'No prompt available for {figure}'}), 404
        prompt = f"{prompt} '{user_input}'"

    chat_completion = openai_client.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=[{"role": "user", "content": prompt}]
    )

    response_content = chat_completion.choices[0].message.content

    db.chat_history.insert_one({
        "email": email,
        "figure": figure,
        "timestamp": datetime.datetime.now().isoformat(),
        "user_message": user_input,
        "bot_response": response_content
    })

    return jsonify(response=response_content)



@app.route('/generate_character_image', methods=['POST'])
def generate_character_image():
    data = request.json
    character = data.get('character')

    if not character:
        return jsonify({"error": "Character name is required"}), 400

    prompt_validation = f"Is {character} a real historical figure?"
    try:
        validation_response = openai_client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt_validation}]
        )
        validation_content = validation_response.choices[0].message.content.strip().lower()
        if "yes" in validation_content:
            prompt = f"Generate an image of {character} as a historical figure in a Disney-style illustration."
            response = openai_client.images.generate(
                model="dall-e-3",
                prompt=prompt,
                size="1024x1024",
                n=1,
                response_format="url"
            )
            image_url = response.data[0].url
            return jsonify({'image_url': image_url})
        else:
            return jsonify({'error': f'{character} is not a known historical figure.'}), 400
    except Exception as e:
        app.logger.error('Error generating image: {}'.format(str(e)))
        return jsonify({'error': 'Error generating image.'}), 500

    

@app.route('/perform_register', methods=['POST'])
def perform_register():
    data = request.get_json()
    email = data['email']
    plain_password = data['password']
    hashed_password = bcrypt.generate_password_hash(plain_password).decode('utf-8')

    if users.find_one({"email": email}):
        return jsonify({"error": "Email already exists"}), 409

    user_id = users.insert_one({
        "email": email,
        "password": hashed_password
    }).inserted_id

    return jsonify({"message": "User registered successfully", "user_id": str(user_id), "email": email}), 201

@app.route('/perform_login', methods=['POST'])
def perform_login():
    data = request.get_json()
    email = data['email']
    password = data['password']
    user = users.find_one({"email": email})

    if user and bcrypt.check_password_hash(user['password'], password):
        chat_history = list(db.chat_history.find({"email": email}))

        for chat in chat_history:
            chat['_id'] = str(chat['_id'])
            if isinstance(chat['timestamp'], datetime.datetime):
                chat['timestamp'] = chat['timestamp'].isoformat()

        return jsonify({"message": "Login successful", "email": email, "chat_history": chat_history}), 200

    return jsonify({"error": "Invalid email or password"}), 401

@app.route('/get_chat_history', methods=['POST'])
def get_chat_history():
    data = request.get_json()
    email = data.get('email')
    figure = data.get('figure')

    if not email or not figure:
        return jsonify({"error": "Missing data"}), 400

    chat_history = list(db.chat_history.find({"email": email, "figure": figure}))

    for chat in chat_history:
        chat['_id'] = str(chat['_id'])
        if isinstance(chat['timestamp'], datetime.datetime):
            chat['timestamp'] = chat['timestamp'].isoformat()

    return jsonify({"chat_history": chat_history})

# Thêm chức năng xử lý testimonials
@app.route('/submit_testimonial', methods=['POST'])
def submit_testimonial():
    data = request.get_json()
    email = data.get('email')
    message = data.get('message')

    if not email or not message:
        return jsonify({"success": False, "error": "Missing email or message"}), 400

    db.testimonials.insert_one({
        "email": email,
        "message": message,
        "timestamp": datetime.datetime.now().isoformat()
    })

    return jsonify({"success": True})

@app.route('/get_testimonials', methods=['GET'])
def get_testimonials():
    testimonials = list(db.testimonials.find())

    for testimonial in testimonials:
        testimonial['_id'] = str(testimonial['_id'])
        if isinstance(testimonial['timestamp'], datetime.datetime):
            testimonial['timestamp'] = testimonial['timestamp'].isoformat()

    return jsonify({"testimonials": testimonials})

# Load historical data from JSON file
def load_history_data():
    with open('history_data.json', 'r') as f:
        return json.load(f)

history_data = load_history_data()

@app.route('/get-history', methods=['GET'])
def get_history():
    country = request.args.get('country')
    if not country:
        return jsonify({'error': 'Country name is required.'}), 400

    events = history_data.get(country, [])
    if not events:
        return jsonify({'error': f'No historical data found for {country}.'}), 404

    return jsonify({'events': events})

@app.route('/get-event-detail', methods=['POST'])
def get_event_detail():
    data = request.get_json()
    prompt = data.get('prompt')

    if not prompt:
        return jsonify({'error': 'Prompt is required.'}), 400

    try:
        response = openai_client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}]
        )
        detail = response.choices[0].message.content.strip()
        return jsonify({'detail': detail})
    except Exception as e:
        app.logger.error('Error processing request: {}'.format(traceback.format_exc()))
        return jsonify({'error': 'Internal Server Error'}), 500




#FlashCard_Question code
def generate_flashcard_question(character):
    prompt = f"""
    Imagine you are {character}.
    Create a quiz question about your life or work.
    Provide the question and the correct answer.
    Format the response as follows:
    Question: <question>
    Answer: <correct answer>
    """
    response = openai_client.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=[
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": prompt}
        ]
    )
    content = response.choices[0].message.content.strip()
    
    lines = content.split('\n')
    if len(lines) < 2:
        raise ValueError("Response does not contain enough lines for a valid quiz question")

    question = lines[0].replace("Question: ", "")
    answer = lines[1].replace("Answer: ", "").strip()

    return {
        'question': question,
        'answer': answer
    }

@app.route('/generate_flashcard', methods=['POST'])
def generate_flashcard():
    data = request.json
    character = data.get('character')
    email = data.get('email')
    
    if not email:
        return jsonify({"error": "Email is required"}), 400

    flashcard_data = generate_flashcard_question(character)
    
    return jsonify({
        'question': flashcard_data['question'],
        'answer': flashcard_data['answer']
    })

@app.route('/save_flashcard', methods=['POST'])
def save_flashcard():
    data = request.json
    email = data.get('email')
    question = data.get('question')
    answer = data.get('answer')
    collection = data.get('collection')

    if not email or not question or not answer or not collection:
        return jsonify({"error": "Email, question, answer, and collection are required"}), 400

    flashcard_data = {
        'email': email,
        'question': question,
        'answer': answer,
        'collection': collection,
        'timestamp': datetime.datetime.now().isoformat()
    }

    flashcards.insert_one(flashcard_data)

    return jsonify({"success": True})

@app.route('/create_flashcard', methods=['POST'])
def create_flashcard():
    data = request.json
    email = data.get('email')
    question = data.get('question')
    answer = data.get('answer')
    collection = data.get('collection')

    if not email or not question or not answer or not collection:
        return jsonify({"error": "Email, question, answer, and collection are required"}), 400

    flashcard_data = {
        'email': email,
        'question': question,
        'answer': answer,
        'collection': collection,
        'timestamp': datetime.datetime.now().isoformat()
    }

    flashcards.insert_one(flashcard_data)

    return jsonify({"success": True})

@app.route('/get_flashcards', methods=['POST'])
def get_flashcards():
    data = request.json
    email = data.get('email')
    if not email:
        return jsonify({"error": "Email is required"}), 400

    user_flashcards = list(flashcards.find({"email": email}))

    for flashcard in user_flashcards:
        flashcard['_id'] = str(flashcard['_id'])
        if isinstance(flashcard['timestamp'], datetime.datetime):
            flashcard['timestamp'] = flashcard['timestamp'].isoformat()

    return jsonify({"flashcards": user_flashcards})

# Hàm để upload file lên Google Cloud Storage và trả về link
def upload_to_gcs(bucket_name, source_file_name, destination_blob_name):
    storage_client = storage.Client()
    bucket = storage_client.bucket(bucket_name)
    blob = bucket.blob(destination_blob_name)

    blob.upload_from_filename(source_file_name)

    return blob.public_url

# Hàm lấy thông tin nhân vật từ API bên ngoài (ví dụ Wikipedia)
def get_character_info(character_name):
    response = requests.get(f"https://en.wikipedia.org/api/rest_v1/page/summary/{character_name}")
    if response.status_code == 200:
        return response.json()
    else:
        return None

def get_related_links(character_name):
    api_key = 'AIzaSyAoE1-k0HBRpKPuWQXGIyD3UaUQ4Jw5gUM'  # Thay thế bằng API key của bạn
    cx = '91322e4d09e594d35'  # Thay thế bằng Custom Search Engine ID của bạn
    search_url = f"https://www.googleapis.com/customsearch/v1?q={character_name}&key={api_key}&cx={cx}"
    
    response = requests.get(search_url)
    if response.status_code == 200:
        search_results = response.json()
        print(search_results)  # Log search results to debug
        links = [item['link'] for item in search_results.get('items', [])]
        return links
    else:
        return []



###############################################


@app.route('/get_character_info', methods=['POST'])
def get_character_info_api():
    data = request.get_json()
    character_name = data.get('character_name')

    if not character_name:
        return jsonify({"error": "No character name provided"}), 400

    # Lấy thông tin nhân vật
    character_info = get_character_info(character_name)
    if not character_info:
        return jsonify({"error": "Character not found"}), 404

    # Lấy các link liên quan
    related_links = get_related_links(character_name)

    # Tạo response
    response = {
        "character_info": character_info,
        "related_links": related_links
    }

    return jsonify(response)





if __name__ == '__main__':
    app.run(debug=True)