import flet as ft
import wget, easyocr


#b = ft.ElevatedButton(text="Transcreva!", on_click=transcricao_texto)
def main(page: ft.Page):

    page.title = "Athena - Home"

    def transcricao_texto():
        pass

    page.navigation_bar = ft.NavigationBar(
        destinations=[
            ft.NavigationDestination(icon=ft.icons.HOME, label="Home"),
            ft.NavigationDestination(icon=ft.icons.HISTORY, label="Histórico"),   
            ft.NavigationDestination(icon=ft.icons.SETTINGS, label="Configurações"),   
        ]
    )
    t = ft.Text(value="Aqui estará o texto da sua imagem.", color="white")
    tb1 = ft.TextField(label="Insira a URL da imagem:")
 
    b = ft.ElevatedButton(text="Transcreva!")
    page.add(tb1, b, t)



ft.app(target=main)