import json
import io

with open('../client/specs.json') as f:
  data = json.load(f)

msize = max([o['mags'][-1]['size'] for o in data])
rcount = len(data)
print(len(data), 'recoils, max length', msize)

with io.StringIO() as output:
  output.write(f'const int RECOILS_LENGTH = {rcount};\n')
  output.write(f'const String names[] = ' + '{"' + '","'.join(x['name'] for x in data) + '"};\n')
  output.write(f'const int sizes[] = ' + '{' + ','.join(str(x["mags"][-1]['size']) for x in data) + '};\n')

  output.write(f'const PROGMEM float XDATA[] = ' + '{')
  for i, o in enumerate(data):
      if i > 0:
          output.write(',')
      output.write(f'{",".join([str(x) for x in extend(o["x"], msize, 0)])}')
  output.write('};\n')

  output.write(f'const PROGMEM float YDATA[] = ' + '{')
  for i, o in enumerate(data):
      if i > 0:
          output.write(',')
      output.write(f'{",".join([str(x) for x in extend(o["y"], msize, 0)])}')
  output.write('};\n')

  output.write(f'const PROGMEM float TDATA[] = ' + '{')
  for i, o in enumerate(data):
      if i > 0:
          output.write(',')
      output.write(f'{",".join([str(x) for x in extend(o["time_points"], msize, 0)])}')
  output.write('};\n')

  output_str = output.getvalue()

  print(output_str)
  with open('../arduino_mouse/src/recoil.inc', 'w') as file:
      file.write(output_str)