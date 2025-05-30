import flet as ft
import random
import string
import os  # Import os for file system interaction
import wget  # Assuming you have wget installed
from easyocr import Reader

def clear_text(page: ft.Page):
  """Clears all text elements from the page, excluding the input field, button, and clear button."""
  text_controls = [control for control in page.controls if isinstance(control, ft.Text)]
  for control in text_controls:
    if control != input_field and control != button and control != clear_button:
      page.controls.remove(control)

  # Update the page to reflect changes
  page.update()

def main(page: ft.Page):

  # Global Variables (if needed)
  global input_field, button, clear_button, output_text  # Declare all four globally

  # Define a function to generate a random filename
  def generate_random_filename(extension):
    letters = string.ascii_lowercase
    random_name = ''.join(random.choice(letters) for i in range(10))
    return f"{random_name}.{extension}"

  # Define a function to handle button click
  def button_click(e):
    url = input_field.value
    # Check if URL ends with .png or .jpg
    if url.lower().endswith((".png", ".jpg")):
      # Generate a random filename with the same extension
      filename = generate_random_filename(url.split(".")[-1])
      try:
        # Download the image using wget
        wget.download(url, filename)

        # Supported languages (replace with desired languages)
        supported_languages = ['en', 'pt', 'es', 'fr']  # Change based on your needs

        # Try OCR with each language
        text = None
        for lang in supported_languages:
          reader = Reader([lang], confidence=0.5)  # Adjust confidence threshold
          result = reader.readtext(filename)
          if result:
            text = result[0][1]  # Get text from the first result
            break  # Stop iterating if text found in a language

        # Update pre-defined text element with extracted text or error message
        output_text.value = f"Texto extraído ({lang}):\n{text}" if text else "Sem texto algum na imagem."

        # Delete old PNGs except the latest (after OCR)
        delete_old_pngs(filename)

      except Exception as e:
        output_text.value = f"Erro ao baixar a imagem: {str(e)}"  # Error message
    else:
      output_text.value = "A URL precisa terminar com .png ou .jpg"  # Invalid URL message

    # Clear text elements before updating (not necessary with pre-defined text)
    # clear_text(page)
    page.update()

  # Define a function to delete old PNGs
  def delete_old_pngs(latest_filename):
    # Get the current directory
    current_dir = os.getcwd()
    # Find all PNG files (ignoring case)
    png_files = [f for f in os.listdir(current_dir) if f.lower().endswith(".png")]

    # Remove all PNGs except the latest one (if any)
    for png_file in png_files:
      if png_file != latest_filename:
        try:
          os.remove(os.path.join(current_dir, png_file))
        except FileNotFoundError:
          pass  # Ignore if file not found

  # Create an input field (now inside main)
  input_field = ft.TextField(label="Insira a URL")
  page.add(input_field)

  # Create a button for downloading (now inside main)
  button = ft.ElevatedButton("Transcreva", on_click=button_click)
  page.add(button)

  # Create a button for clearing text (now inside main)
  clear_button = ft.ElevatedButton("Limpar", on_click=lambda e: clear_text(page))  # Pass page as argument
  page.add(clear_button)

  # Pre-defined text element to display extracted text or error messages
  output_text = ft.Text(value="")
  page.add(output_text)

ft.app(target=main)
