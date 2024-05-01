import flet as ft

def main(page: ft.Page):

    page.title = "Athena - Home"
    page.navigation_bar = ft.NavigationBar(
        destinations=[
            ft.NavigationDestination(icon=ft.icons.HOME, label="Home"),
            ft.NavigationDestination(icon=ft.icons.HISTORY, label="Histórico"),   
            ft.NavigationDestination(icon=ft.icons.SETTINGS, label="Configurações"),   
        ]
    )
    page.add(ft.Text("Body!"))

ft.app(target=main)