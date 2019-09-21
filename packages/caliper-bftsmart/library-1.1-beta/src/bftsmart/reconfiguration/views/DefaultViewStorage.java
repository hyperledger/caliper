/**
Copyright (c) 2007-2013 Alysson Bessani, Eduardo Alchieri, Paulo Sousa, and the authors indicated in the @author tags

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
package bftsmart.reconfiguration.views;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.ObjectInputStream;
import java.io.ObjectOutputStream;

/**
 *
 * @author eduardo
 */
public class DefaultViewStorage implements ViewStorage {

    private String path = "";

    public DefaultViewStorage() {
        String sep = System.getProperty("file.separator");
        path = System.getProperty("user.dir") + sep + "config";
        File f = new File(path);
        if (!f.exists()) {
            f.mkdirs();
        }
        path = path + sep + "currentView";
    }

    @Override
    public boolean storeView(View view) {
        if (!view.equals(readView())) {
            File f = new File(path);
            try {
                ObjectOutputStream oos = new ObjectOutputStream(new FileOutputStream(f));
                oos.writeObject(view);
                oos.flush();
                oos.close();
                return true;
            } catch (Exception e) {
                return false;
            }
        }
        return true;
    }

    @Override
    public View readView() {
        File f = new File(path);
        if (!f.exists()) {
            return null;
        }
        try {
            ObjectInputStream ois = new ObjectInputStream(new FileInputStream(f));
            View ret = (View) ois.readObject();
            ois.close();
            
            return ret;
        } catch (Exception e) {
            return null;
        }
    }

    public byte[] getBytes(View view) {
        try {
            ByteArrayOutputStream baos = new ByteArrayOutputStream(4);
            ObjectOutputStream oos = new ObjectOutputStream(baos);
            oos.writeObject(view);
            return baos.toByteArray();
        } catch (Exception e) {
            return null;
        }
    }

    public View getView(byte[] bytes) {
        try {
            ByteArrayInputStream bais = new ByteArrayInputStream(bytes);
            ObjectInputStream ois = new ObjectInputStream(bais);
            return (View) ois.readObject();
        } catch (Exception e) {
            return null;
        }
    }
}
