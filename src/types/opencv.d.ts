declare module '@techstark/opencv-js' {
  export interface Mat {
    rows: number;
    cols: number;
    data: Uint8Array;
    delete(): void;
    roi(rect: { x: number; y: number; width: number; height: number }): Mat;
  }

  export interface MatVector {
    size(): number;
    get(index: number): Mat;
    delete(): void;
  }

  export interface OpenCV {
    Mat: {
      new(rows: number, cols: number, type: number, buffer?: ArrayBuffer): Mat;
      zeros(rows: number, cols: number, type: number): Mat;
    };
    MatVector: {
      new(): MatVector;
    };
    CV_8U: number;
    CV_8UC3: number;
    CV_64F: number;
    COLOR_BGR2GRAY: number;
    COLOR_GRAY2BGR: number;
    COLOR_BGR2HSV: number;
    RETR_EXTERNAL: number;
    CHAIN_APPROX_SIMPLE: number;
    getBuildInformation(): string;
    onRuntimeInitialized?: () => void;
    cvtColor(src: Mat, dst: Mat, code: number): void;
    GaussianBlur(src: Mat, dst: Mat, size: { width: number; height: number }, sigma: number): void;
    Canny(src: Mat, dst: Mat, threshold1: number, threshold2: number): void;
    findContours(image: Mat, contours: MatVector, hierarchy: Mat, mode: number, method: number): void;
    arcLength(curve: Mat, closed: boolean): number;
    approxPolyDP(curve: Mat, approx: Mat, epsilon: number, closed: boolean): void;
    contourArea(contour: Mat): number;
    boundingRect(points: Mat): { x: number; y: number; width: number; height: number };
    convexHull(points: Mat, hull: Mat): void;
    inRange(src: Mat, lowerb: Mat, upperb: Mat, dst: Mat): void;
    countNonZero(src: Mat): number;
    Sobel(src: Mat, dst: Mat, ddepth: number, dx: number, dy: number, ksize: number): void;
    convertScaleAbs(src: Mat, dst: Mat): void;
    mean(src: Mat): number[];
    moments(array: Mat, binaryImage?: boolean): {
      m00: number;
      m01: number;
      m10: number;
    };
  }

  const cv: OpenCV;
  export default cv;
} 