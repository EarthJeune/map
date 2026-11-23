with open('js/walker.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find("if (state.currentStationId === 'rares')")
if idx != -1:
    print(text[idx:idx+1500])

