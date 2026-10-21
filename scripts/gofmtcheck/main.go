// Command gofmtcheck lists Go files that are not gofmt-formatted and exits
// non-zero if there are any. It is a portable replacement for `gofmt -l`
// in shell pipelines, so `make backend-format` works the same on Windows.
package main

import (
	"bytes"
	"fmt"
	"go/format"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
)

func main() {
	roots := os.Args[1:]
	if len(roots) == 0 {
		roots = []string{"."}
	}
	var bad []string
	for _, root := range roots {
		err := filepath.WalkDir(root, func(p string, d fs.DirEntry, err error) error {
			if err != nil {
				return err
			}
			if d.IsDir() && (d.Name() == "node_modules" || strings.HasPrefix(d.Name(), ".") && p != root) {
				return filepath.SkipDir
			}
			if d.IsDir() || !strings.HasSuffix(p, ".go") {
				return nil
			}
			src, err := os.ReadFile(p)
			if err != nil {
				return err
			}
			// Git stores LF; a core.autocrlf checkout must not read as unformatted.
			src = bytes.ReplaceAll(src, []byte("\r\n"), []byte("\n"))
			out, err := format.Source(src)
			if err != nil {
				return fmt.Errorf("%s: %w", p, err)
			}
			if !bytes.Equal(src, out) {
				bad = append(bad, p)
			}
			return nil
		})
		if err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(2)
		}
	}
	if len(bad) > 0 {
		fmt.Fprintln(os.Stderr, "Not gofmt-formatted (run `gofmt -w` on them):")
		for _, p := range bad {
			fmt.Fprintln(os.Stderr, "  "+p)
		}
		os.Exit(1)
	}
	fmt.Println("All Go files are gofmt-formatted.")
}
