package combat
import("os";"path/filepath";"testing")
func TestLoadAreaDamageProfile(t *testing.T){path:=filepath.Join(t.TempDir(),"actions.json");if err:=os.WriteFile(path,[]byte(`{"actions":[{"id":"trueno","area":{"radius":2,"damage":25}}]}`),0600);err!=nil{t.Fatal(err)};catalog,err:=LoadCatalog(path);if err!=nil{t.Fatal(err)};p:=catalog.Get("trueno");if p==nil||p.Area==nil||p.Area.Radius!=2||p.Area.Damage!=25{t.Fatalf("unexpected area damage profile: %+v",p)}}
