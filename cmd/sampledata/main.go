// Command sampledata writes a small fake manga library for local development:
//
//	go run ./cmd/sampledata data/sample
package main

import (
	"archive/zip"
	"fmt"
	"image"
	"image/color"
	"image/draw"
	"image/jpeg"
	"io"
	"log"
	"os"
	"path/filepath"

	xdraw "golang.org/x/image/draw"
	"golang.org/x/image/font"
	"golang.org/x/image/font/basicfont"
	"golang.org/x/image/math/fixed"
)

func main() {
	root := "data/sample"
	if len(os.Args) > 1 {
		root = os.Args[1]
	}
	type vol struct {
		path   string
		pages  int
		folder bool
		spread int // index of a double-width page, or -1
	}
	vols := []vol{
		{"Author A/Series Alpha/Vol 01.cbz", 14, false, 5},
		{"Author A/Series Alpha/Vol 02.cbz", 12, false, -1},
		{"Author A/Series Alpha/Vol 10.cbz", 10, false, -1},
		{"Author A/Series Alpha/Vol 03", 9, true, -1},
		{"Author A/Oneshot.zip", 8, false, -1},
		{"Author B/Series Beta/Chapter 1.cbz", 6, false, -1},
		{"Author B/Series Beta/Chapter 2.cbz", 6, false, 2},
		{"Author B/Series Beta/Chapter 3.cbz", 7, false, -1},
		{"Author B/Sketchbook", 5, true, -1},
		{"Loose Artbook", 4, true, -1},
		{"_drafts/Unfinished.cbz", 3, false, -1},
	}
	for i, v := range vols {
		hue := uint8(40 + i*19)
		p := filepath.Join(root, filepath.FromSlash(v.path))
		if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
			log.Fatal(err)
		}
		label := filepath.Base(v.path)
		if v.folder {
			if err := os.MkdirAll(p, 0o755); err != nil {
				log.Fatal(err)
			}
			for n := 0; n < v.pages; n++ {
				f, err := os.Create(filepath.Join(p, fmt.Sprintf("%03d.jpg", n+1)))
				if err != nil {
					log.Fatal(err)
				}
				writePage(f, label, n, n == v.spread, hue)
				f.Close()
			}
			continue
		}
		f, err := os.Create(p)
		if err != nil {
			log.Fatal(err)
		}
		zw := zip.NewWriter(f)
		for n := 0; n < v.pages; n++ {
			w, err := zw.CreateHeader(&zip.FileHeader{Name: fmt.Sprintf("page%d.jpg", n+1), Method: zip.Store})
			if err != nil {
				log.Fatal(err)
			}
			writePage(w, label, n, n == v.spread, hue)
		}
		zw.Close()
		f.Close()
	}
	fmt.Println("sample library written to", root)
}

func writePage(w io.Writer, title string, n int, wide bool, hue uint8) {
	width, height := 840, 1200
	if wide {
		width = 1680
	}
	img := image.NewRGBA(image.Rect(0, 0, width, height))
	bg := color.RGBA{hue, 255 - hue/2, 200 - hue/3, 255}
	if n == 0 {
		bg = color.RGBA{30, 30, 40, 255}
	}
	draw.Draw(img, img.Bounds(), &image.Uniform{bg}, image.Point{}, draw.Src)
	// Panel borders.
	for _, r := range []image.Rectangle{
		image.Rect(40, 40, width-40, height/2-20),
		image.Rect(40, height/2+20, width/2-20, height-40),
		image.Rect(width/2+20, height/2+20, width-40, height-40),
	} {
		border(img, r, color.RGBA{20, 20, 20, 255})
	}
	text := fmt.Sprintf("%d", n+1)
	if n == 0 {
		text = title
	}
	if wide {
		text += " (spread)"
	}
	bigText(img, text, height/4)
	if err := jpeg.Encode(w, img, &jpeg.Options{Quality: 80}); err != nil {
		log.Fatal(err)
	}
}

func border(img *image.RGBA, r image.Rectangle, c color.Color) {
	for t := 0; t < 6; t++ {
		for x := r.Min.X; x < r.Max.X; x++ {
			img.Set(x, r.Min.Y+t, c)
			img.Set(x, r.Max.Y-t, c)
		}
		for y := r.Min.Y; y < r.Max.Y; y++ {
			img.Set(r.Min.X+t, y, c)
			img.Set(r.Max.X-t, y, c)
		}
	}
}

// bigText renders with the tiny built-in font and scales it up.
func bigText(dst *image.RGBA, s string, cy int) {
	face := basicfont.Face7x13
	small := image.NewRGBA(image.Rect(0, 0, len(s)*7+4, 16))
	d := font.Drawer{Dst: small, Src: image.White, Face: face, Dot: fixed.P(2, 13)}
	d.DrawString(s)
	scale := min((dst.Bounds().Dx()-160)/small.Bounds().Dx(), 12)
	w, h := small.Bounds().Dx()*scale, small.Bounds().Dy()*scale
	x := (dst.Bounds().Dx() - w) / 2
	xdraw.NearestNeighbor.Scale(dst, image.Rect(x, cy-h/2, x+w, cy+h/2), small, small.Bounds(), xdraw.Over, nil)
}
