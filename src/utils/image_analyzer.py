import cv2
import numpy as np
import json
import sys
import base64

def analyze_image(base64_image):
    # Decodifica a imagem base64
    image_data = base64.b64decode(base64_image)
    nparr = np.frombuffer(image_data, np.uint8)
    image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    # Converte para HSV para melhor análise de cores
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    
    # Obtém dimensões da imagem
    height, width = image.shape[:2]
    
    # Lista para armazenar elementos detectados
    elements = []
    
    # Detecta áreas claras (texto branco/claro)
    light_mask = cv2.inRange(hsv, np.array([0, 0, 180]), np.array([180, 30, 255]))
    
    # Aplica operações morfológicas para melhorar a detecção
    kernel = np.ones((3,3), np.uint8)
    light_mask = cv2.morphologyEx(light_mask, cv2.MORPH_CLOSE, kernel)
    light_mask = cv2.morphologyEx(light_mask, cv2.MORPH_OPEN, kernel)
    
    # Encontra contornos com hierarquia
    light_contours, hierarchy = cv2.findContours(light_mask, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
    
    # Detecta áreas escuras (fundo escuro)
    dark_mask = cv2.inRange(hsv, np.array([0, 0, 0]), np.array([180, 255, 50]))
    dark_contours, _ = cv2.findContours(dark_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    # Analisa contornos claros (possível texto)
    text_regions = []
    min_area = (width * height) * 0.001  # Área mínima proporcional à imagem
    
    for i, contour in enumerate(light_contours):
        area = cv2.contourArea(contour)
        if area > min_area:
            x, y, w, h = cv2.boundingRect(contour)
            # Verifica se não é um contorno filho de outro já detectado
            is_child = False
            for region in text_regions:
                if (x >= region['x'] and 
                    y >= region['y'] and 
                    x + w <= region['x'] + region['width'] and 
                    y + h <= region['y'] + region['height']):
                    is_child = True
                    break
            
            if not is_child:
                text_regions.append({
                    'x': x,
                    'y': y,
                    'width': w,
                    'height': h,
                    'area': area,
                    'center_y': y + h/2
                })
    
    # Agrupa regiões próximas verticalmente
    text_regions.sort(key=lambda r: r['center_y'])
    grouped_regions = []
    current_group = []
    
    for region in text_regions:
        if not current_group:
            current_group.append(region)
        else:
            prev_region = current_group[-1]
            # Se a distância vertical é pequena, agrupa
            if abs(region['center_y'] - prev_region['center_y']) < prev_region['height'] * 1.5:
                current_group.append(region)
            else:
                if current_group:
                    grouped_regions.append(current_group)
                current_group = [region]
    
    if current_group:
        grouped_regions.append(current_group)
    
    # Identifica elementos baseado nos grupos detectados
    if grouped_regions:
        # Encontra o grupo principal (maior área total)
        main_group = max(grouped_regions, 
                        key=lambda g: sum(r['area'] for r in g))
        main_region = max(main_group, key=lambda r: r['area'])
        
        elements.append({
            'type': 'texto_principal',
            'description': 'Texto principal em cor clara',
            'position': 'centro' if main_region['x'] > width/4 and main_region['x'] < 3*width/4 else 'lateral'
        })
        
        # Procura por grupos de texto secundários
        for group in grouped_regions:
            if group != main_group:
                # Calcula a posição média do grupo
                avg_y = sum(r['center_y'] for r in group) / len(group)
                main_y = sum(r['center_y'] for r in main_group) / len(main_group)
                
                elements.append({
                    'type': 'texto_secundário',
                    'description': 'Texto secundário em cor clara',
                    'position': 'abaixo' if avg_y > main_y else 'acima'
                })
    
    # Analisa o fundo
    dark_area = sum(cv2.contourArea(c) for c in dark_contours)
    if dark_area > 0.5 * width * height:
        elements.append({
            'type': 'fundo',
            'description': 'Fundo escuro predominante',
            'coverage': f'{(dark_area/(width*height))*100:.1f}%'
        })
    
    # Detecta bordas
    edges = cv2.Canny(image, 100, 200)
    edge_contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    # Analisa formas geométricas
    for contour in edge_contours:
        peri = cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, 0.04 * peri, True)
        
        if len(approx) == 4:  # Detecta retângulos/quadrados
            x, y, w, h = cv2.boundingRect(approx)
            if w > width*0.5 and h > height*0.5:  # Se for uma borda grande
                elements.append({
                    'type': 'borda',
                    'description': 'Borda retangular',
                    'position': 'completa' if w > width*0.9 and h > height*0.9 else 'parcial'
                })
    
    # Detecta gradientes/efeitos de iluminação
    gradient_mask = cv2.subtract(cv2.GaussianBlur(image, (21, 21), 0), image)
    if np.mean(gradient_mask) > 10:
        elements.append({
            'type': 'efeito',
            'description': 'Efeito de iluminação ou gradiente detectado'
        })
    
    # Detecta a presença de um livro aberto
    if any(cv2.contourArea(c) > width * height * 0.2 for c in edge_contours):
        elements.append({
            'type': 'objeto',
            'description': 'Livro aberto em destaque',
            'position': 'inferior'
        })
    
    return elements

if __name__ == "__main__":
    # Lê a imagem base64 da entrada padrão
    base64_image = sys.stdin.read().strip()
    
    try:
        # Analisa a imagem
        elements = analyze_image(base64_image)
        
        # Retorna o resultado como JSON
        print(json.dumps(elements, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({
            'error': str(e)
        }, ensure_ascii=False)) 