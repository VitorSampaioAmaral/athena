import flet as ft
import requests

def main(page: ft.Page):

    page.title = "Athena - Home"
    page.navigation_bar = ft.NavigationBar(
        destinations=[
            ft.NavigationDestination(icon=ft.icons.HOME, label="Home"),
            ft.NavigationDestination(icon=ft.icons.HISTORY, label="Histórico"),   
            ft.NavigationDestination(icon=ft.icons.SETTINGS, label="Configurações"),   
        ]
    )
    t = ft.Text(value="Aqui estará o texto da sua imagem.", color="white")
    tb1 = ft.TextField(label="Insira a URL da imagem:")
 
    b = ft.ElevatedButton(text="Transcreva!", on_click=fun_transcricao)
    page.add(tb1, b, t)


def fun_transcricao(entrada):
    #reader = easyocr.Reader(['en'])


    transcription_output = requests.get(tb1.value)
    
    with open(entrada, 'wb') as f:
        f.write(transcription_output.content)

    #t.value = transcription_output


ft.app(target=main)