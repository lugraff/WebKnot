interface TailwindColor {
  name: string;
  hexCode: string;
}

interface TailwindColors {
  colors: TailwindColor[];
}
//TODO direkt von tailwind importieren?
//NOTICE Hier immer Tailwind Farben aktuell halten! (von tailwind.json)
const tailwindColors: TailwindColors = {
  colors: [
    { name: 'white', hexCode: '#ffffff' },
    { name: 'black', hexCode: '#000000' },
    { name: 'warning', hexCode: '#ffcc00' },
    { name: 'danger', hexCode: '#f54b4c' },
    { name: 'primary', hexCode: '#336699' },
    { name: 'secondary', hexCode: '#996633' },
    { name: 'tertiary', hexCode: '#369369' },
    { name: 'bgB', hexCode: '#333333' },
    { name: 'bgA', hexCode: '#112233' },
    { name: 'subtle', hexCode: '#646464' },
    { name: 'darkgrey', hexCode: '#434343' },
    { name: 'ring', hexCode: '#2e528c' },
    { name: 'dark', hexCode: '#000000cc' },
  ],
};

export function getTailwindColorHexCode(colorName: string | undefined | null) {
  if (colorName !== undefined && colorName !== null) {
    if (colorName.startsWith('#')) {
      return colorName;
    } else {
      if (colorName === 'transparent') {
        return '#ffffff00';
      }
      for (const color of tailwindColors.colors) {
        if (color.name === colorName) {
          return color.hexCode;
        }
      }
    }
  }
  return '#ffffff';
}
