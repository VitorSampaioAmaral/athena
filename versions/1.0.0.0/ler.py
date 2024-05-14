import easyocr, wget


url = "https://pngimg.com/uploads/tesla_car/tesla_car_PNG23.png"
wget.download(url, 'C:/Users/vi/athena/carro.png')

def transcreva():
    reader = easyocr.Reader(['en','hi'])
    result = reader.readtext('C:/Users/vi/athena/carro.png')
    for (bbox, text, prob) in result:
        print(f'{text}')

transcreva()
