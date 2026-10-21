package media

import (
	"bytes"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"os"
	"path/filepath"
	"testing"

	"mangayomi/internal/store"
)

func TestBoxPlaneAverages(t *testing.T) {
	// 5x2 RGBA-like plane with 2 channels; f=2 drops the trailing column.
	pix := []byte{
		0, 100, 10, 100, 20, 0, 30, 0, 99, 99,
		40, 100, 50, 100, 60, 0, 70, 0, 99, 99,
	}
	got := boxPlane(pix, 10, 2, 1, 2, 2)
	want := []byte{25, 100, 45, 0}
	if !bytes.Equal(got, want) {
		t.Fatalf("boxPlane = %v, want %v", got, want)
	}
}

// Covers take a plane fast path for the common decoded formats and the
// generic scaler for the rest; every path must keep colour, layout and
// aspect. Pages are red on the left half and blue on the right.
func TestCoverKeepsColourAndAspect(t *testing.T) {
	red, blue := color.RGBA{200, 40, 40, 255}, color.RGBA{40, 40, 200, 255}
	at := func(x, w int) color.RGBA {
		if x < w/2 {
			return red
		}
		return blue
	}
	split := func(m settable) image.Image {
		b := m.Bounds()
		for y := b.Min.Y; y < b.Max.Y; y++ {
			for x := b.Min.X; x < b.Max.X; x++ {
				m.Set(x, y, at(x, b.Dx()))
			}
		}
		return m
	}
	ycbcr := func(w, h int, r image.YCbCrSubsampleRatio) image.Image {
		m := image.NewYCbCr(image.Rect(0, 0, w, h), r)
		for y := 0; y < h; y++ {
			for x := 0; x < w; x++ {
				c := at(x, w)
				yy, cb, cr := color.RGBToYCbCr(c.R, c.G, c.B)
				m.Y[m.YOffset(x, y)] = yy
				m.Cb[m.COffset(x, y)], m.Cr[m.COffset(x, y)] = cb, cr
			}
		}
		return m
	}
	cases := []struct {
		name string
		img  image.Image
		gray bool
	}{
		{"ycbcr 4:2:0 odd size", ycbcr(1203, 1701, image.YCbCrSubsampleRatio420), false},
		{"ycbcr 4:4:4", ycbcr(1600, 2400, image.YCbCrSubsampleRatio444), false},
		{"ycbcr 4:1:0", ycbcr(2001, 2803, image.YCbCrSubsampleRatio410), false},
		{"gray", split(image.NewGray(image.Rect(0, 0, 1201, 1700))), true},
		{"rgb png", split(image.NewNRGBA(image.Rect(0, 0, 1200, 1800))), false},
		{"paletted fallback", split(image.NewPaletted(image.Rect(0, 0, 900, 1350), color.Palette{red, blue})), false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			dir := t.TempDir()
			folder := filepath.Join(dir, "Vol 01")
			if err := os.MkdirAll(folder, 0o755); err != nil {
				t.Fatal(err)
			}
			var buf bytes.Buffer
			if err := png.Encode(&buf, c.img); err != nil {
				t.Fatal(err)
			}
			if _, ok := c.img.(*image.YCbCr); ok {
				buf.Reset()
				if err := jpeg.Encode(&buf, c.img, &jpeg.Options{Quality: 95}); err != nil {
					t.Fatal(err)
				}
			}
			if err := os.WriteFile(filepath.Join(folder, "001.img"), buf.Bytes(), 0o644); err != nil {
				t.Fatal(err)
			}
			s := New(filepath.Join(dir, "covers"))
			defer s.Close()
			p, err := s.EnsureCover(store.WorkFile{
				Work:        store.Work{ID: 1, Kind: store.KindFolder, RelPath: "Vol 01"},
				LibraryPath: dir,
				Pages:       []string{"001.img"},
			})
			if err != nil {
				t.Fatal(err)
			}
			f, err := os.Open(p)
			if err != nil {
				t.Fatal(err)
			}
			defer f.Close()
			thumb, err := jpeg.Decode(f)
			if err != nil {
				t.Fatal(err)
			}
			src := c.img.Bounds()
			tb := thumb.Bounds()
			wantH := src.Dy() * coverWidth / src.Dx()
			if tb.Dx() != coverWidth || tb.Dy() < wantH-2 || tb.Dy() > wantH+2 {
				t.Fatalf("thumbnail %dx%d, want %dx%d", tb.Dx(), tb.Dy(), coverWidth, wantH)
			}
			for _, pt := range []image.Point{{tb.Dx() / 4, tb.Dy() / 2}, {tb.Dx() * 3 / 4, tb.Dy() / 2}, {tb.Dx() - 2, tb.Dy() - 2}} {
				want := at(pt.X, tb.Dx())
				if c.gray {
					want = color.RGBAModel.Convert(color.GrayModel.Convert(want)).(color.RGBA)
				}
				got := color.RGBAModel.Convert(thumb.At(pt.X, pt.Y)).(color.RGBA)
				if diff(got.R, want.R) > 12 || diff(got.G, want.G) > 12 || diff(got.B, want.B) > 12 {
					t.Fatalf("pixel %v = %v, want about %v", pt, got, want)
				}
			}
		})
	}
}

type settable interface {
	image.Image
	Set(x, y int, c color.Color)
}

func diff(a, b uint8) int {
	if a > b {
		return int(a - b)
	}
	return int(b - a)
}
