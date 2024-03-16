#include <Mouse.h>
#include <Arduino.h>
const float mx[] = { 0,-4.5,-16.0,-14.8,-31.5,-32.9,-45.7,-61.0,-59.0,-39.0,-35.1,-25.5,-4.6,9.5,12.3,-5.7,-31.5,-46.0,-43.2,-29.2,-16.1,4.5,8.5,8.1,-0.7,-13.2,-17.2 };
const float my[] = { 0,-33.7,-60.6,-92.6,-123.8,-153.2,-188.9,-213.2,-250.4,-285.1,-322.7,-333.2,-332.2,-335.6,-351.1,-366.1,-364.0,-375.8,-388.7,-395.2,-397.4,-396.9,-399.0,-409.4,-424.0,-432.5,-448.0 };
const long mt[] ={ 0,64,129,193,258,322,387,451,516,580,645,709,774,838,903,967,1032,1096,1161,1225,1290,1354,1419,1483,1548,1612,1677 };
const long n = 27 ;
float scale = 1.0;
const int invert = 1;  // Or -1.

void setup()
{
//   Serial.begin( 115200 );
// #if !defined(__MIPSEL__)
//   while (!Serial); // Wait for serial port to connect - used on Leonardo, Teensy and other boards with built-in USB CDC serial connection
// #endif
//   Serial.println("Start");
  Mouse.begin();
  pinMode(2, INPUT);
  pinMode(3, OUTPUT);
  pinMode(4, OUTPUT);
  digitalWrite(3, HIGH);
  digitalWrite(4, LOW);
  Mouse.begin();
}

long start_time = 0;
bool shooting = false;
long idx = 0; // Index of the point we currently moving from;
long mouse_x = 0;
long mouse_y = 0; 
long signals = 0;

void move() {
  long t = millis() - start_time;
  while (idx + 1 < n && mt[idx + 1] <= t) {
    idx++;
    // Serial.println(String("shot ") + String(idx + 1));
  }
  if (idx + 1 >= n) {
    // Serial.println(String(signals) + " finished");    
    shooting = false;
    delay(50);
    Mouse.release(MOUSE_LEFT);
    delay(10);
    Mouse.release(MOUSE_RIGHT);
    return;
  }
  float p = (1.0 * (t - mt[idx])) / (mt[idx + 1] - mt[idx]);
  if (p < 0) p = 0;
  if (p > 1) p = 1;
  long x = -round(scale * (mx[idx] + p * (mx[idx + 1] - mx[idx])));
  long y = - invert * round(scale * (my[idx] + p * (my[idx + 1] - my[idx])));
  if (x != mouse_x || y != mouse_y) {
    // Serial.println(String(t) + " " + String(p) + ": (" + String(x) + "," + String(y)  + ") d (" + String(x - mouse_x) + "," + String(y - mouse_y) + ")");
    Mouse.move(x - mouse_x, y - mouse_y, 0);
    signals++;
    mouse_x = x;
    mouse_y = y;
  }
}

const float circle_speed = 3 * 2 * 3.141 / 1000;
const float radius = 40.0;

void move_circle() {
  long t = millis() - start_time;
  while (idx + 1 < n && mt[idx + 1] <= t) idx++;
  if (idx + 1 >= n) {
    // Serial.println(String(signals) + " finished");    
    shooting = false;
    delay(50);
    Mouse.release(MOUSE_LEFT);
    delay(10);
    Mouse.release(MOUSE_RIGHT);
    return;
  }  
  long x = -round(radius * cos(-t * circle_speed));
  long y = -round(radius * sin(-t * circle_speed));
  if (x != mouse_x || y != mouse_y) {
    // Serial.println(String(t) + " " + String(p) + ": (" + String(x) + "," + String(y)  + ") d (" + String(x - mouse_x) + "," + String(y - mouse_y) + ")");
    Mouse.move(x - mouse_x, y - mouse_y, 0);
    signals++;
    mouse_x = x;
    mouse_y = y;
  }
}


void move_line() {
  long t = millis() - start_time;
  while (idx + 1 < n && mt[idx + 1] <= t) idx++;
  if (t > 1000) {
    shooting = false;
    return;
  }
  long x = t / 2;
  long y = 0;
  if (x != mouse_x || y != mouse_y) {
    // Serial.println(String(t) + " " + String(p) + ": (" + String(x) + "," + String(y)  + ") d (" + String(x - mouse_x) + "," + String(y - mouse_y) + ")");
    Mouse.move(x - mouse_x, y - mouse_y, 0);
    signals++;
    mouse_x = x;
    mouse_y = y;
  }
}

int scale_modifer = 0;

void loop()
{
    if (shooting) move();
    // if (shooting) move_line();
    if (digitalRead(2) == HIGH) {
      if (!shooting) {
        // Serial.println(String("scale ") + String(scale));
        shooting = true;
        idx = 0;
        mouse_x = 0;
        mouse_y = 0;
        signals = 0;
        Mouse.press(MOUSE_RIGHT);
        delay(700);
        Mouse.press(MOUSE_LEFT);
        // Serial.println(String("shot ") + String(idx + 1));
        start_time = millis();
      }
    }
    if (digitalRead(5) == HIGH) {
      // scale = 5 * (1.0 - (scale_modifer - 1) * 0.02);
      // Serial.println(String("scale ") + String(scale));
      // scale_modifer = (scale_modifer + 1) % 3;
      // delay(1000);
      // Serial.println(">>>");
      // Mouse.move(-1,0,0); 
    }
}