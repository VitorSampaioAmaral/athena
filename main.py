import flet as ft
import wget, easyocr

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


def fun_transcricao():
    reader = easyocr.Reader(['en'])


    transcription_output = wget.download(tb1.value, 'C:/Users/vitor.6956/proj_py/athena/imagem.png')

    resultado = reader.readtext()    

ft.app(target=main)